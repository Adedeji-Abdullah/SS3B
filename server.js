import "dotenv/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import next from "next";
import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import { RATING_VALUES, SUBJECTS, normalizeStudentName } from "./lib/subjects.js";

const port = Number.parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const sessionCookie = "class_voice_session";
const sessionDurationSeconds = 60 * 60 * 12;
const mongoUri = process.env.MONGODB_URI || process.env.DATABASE_URL;
const sessionSecret = process.env.SESSION_SECRET;
const adminPassword = process.env.ADMIN_PASSWORD;

if (!mongoUri || !/^mongodb(\+srv)?:\/\//i.test(mongoUri)) {
  throw new Error("Set MONGODB_URI to a valid MongoDB connection string (DATABASE_URL is also accepted).");
}
if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error("Set SESSION_SECRET to a random value at least 32 characters long.");
}
if (!adminPassword) {
  throw new Error("Set ADMIN_PASSWORD to a strong administrator password.");
}

const url = new URL(mongoUri);
if (!url.pathname || url.pathname === "/") {
  throw new Error("The MongoDB connection string must include a database name.");
}

const client = new MongoClient(mongoUri);
await client.connect();
const database = client.db();
const studentsCollection = database.collection("students");
const votesCollection = database.collection("votes");

await Promise.all([
  studentsCollection.createIndex({ normalizedName: 1 }, { unique: true }),
  votesCollection.createIndex({ studentId: 1 }, { unique: true }),
]);

function sign(value) {
  return createHmac("sha256", sessionSecret).update(value).digest("base64url");
}

function createSession(role, studentId) {
  const payload = Buffer.from(
    JSON.stringify({ role, studentId, expiresAt: Date.now() + sessionDurationSeconds * 1000 }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function readSession(token) {
  if (!token) return null;
  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length) return null;

  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
}

function sessionMiddleware(request, response, nextMiddleware) {
  const cookies = Object.fromEntries(
    (request.headers.cookie || "")
      .split(";")
      .map((part) => part.trim().split(/=(.*)/s).slice(0, 2))
      .filter(([name, value]) => name && value !== undefined)
      .map(([name, value]) => [name, decodeURIComponent(value)]),
  );
  request.session = readSession(cookies[sessionCookie]);
  nextMiddleware();
}

function setSessionCookie(response, role, studentId) {
  response.cookie(sessionCookie, createSession(role, studentId), {
    httpOnly: true,
    secure: !dev,
    sameSite: "lax",
    maxAge: sessionDurationSeconds * 1000,
    path: "/",
  });
}

function requireRole(role) {
  return (request, response, nextMiddleware) => {
    if (request.session?.role !== role) {
      return response.status(401).json({ error: "Please sign in to continue." });
    }
    nextMiddleware();
  };
}

function validRatings(ratings) {
  if (!Array.isArray(ratings) || ratings.length !== SUBJECTS.length) return false;
  const bySubject = new Map(ratings.map((rating) => [rating?.subject, rating?.percentage]));
  return (
    bySubject.size === SUBJECTS.length &&
    SUBJECTS.every((subject) => RATING_VALUES.includes(bySubject.get(subject)))
  );
}

function constantTimeEqual(first, second) {
  const firstHash = createHmac("sha256", sessionSecret).update(first).digest();
  const secondHash = createHmac("sha256", sessionSecret).update(second).digest();
  return timingSafeEqual(firstHash, secondHash);
}

const server = express();
server.disable("x-powered-by");
server.use(express.json({ limit: "16kb" }));
server.use(sessionMiddleware);
server.use((request, response, nextMiddleware) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("X-Frame-Options", "DENY");
  nextMiddleware();
});

server.post("/api/auth/student", async (request, response, nextMiddleware) => {
  try {
    const name = typeof request.body?.name === "string" ? request.body.name.trim().replace(/\s+/g, " ") : "";
    if (!name || name.length > 100) {
      return response.status(400).json({ error: "Enter a name between 1 and 100 characters." });
    }

    const normalizedName = normalizeStudentName(name);
    let student;
    try {
      await studentsCollection.updateOne(
        { normalizedName },
        { $setOnInsert: { name, normalizedName, createdAt: new Date() } },
        { upsert: true },
      );
      student = await studentsCollection.findOne({ normalizedName });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      student = await studentsCollection.findOne({ normalizedName });
    }

    if (!student) throw new Error("Student record could not be loaded after sign-in.");
    setSessionCookie(response, "student", student._id.toString());
    response.json({ student: { id: student._id.toString(), name: student.name } });
  } catch (error) {
    nextMiddleware(error);
  }
});

server.post("/api/auth/admin", (request, response) => {
  const password = typeof request.body?.password === "string" ? request.body.password : "";
  if (!constantTimeEqual(password, adminPassword)) {
    return response.status(401).json({ error: "Incorrect administrator password." });
  }
  setSessionCookie(response, "admin");
  response.json({ authenticated: true });
});

server.get("/api/auth/me", (request, response) => {
  if (!request.session) return response.status(401).json({ error: "Not signed in." });
  if (request.session.role === "admin") return response.json({ role: "admin" });
  if (request.session.role !== "student" || !ObjectId.isValid(request.session.studentId)) {
    return response.status(401).json({ error: "Invalid session." });
  }

  studentsCollection.findOne({ _id: new ObjectId(request.session.studentId) })
    .then(async (student) => {
      if (!student) return response.status(401).json({ error: "Student session is no longer valid." });
      const hasVoted = await votesCollection.findOne({ studentId: student._id }, { projection: { _id: 1 } });
      response.json({ role: "student", student: { id: student._id.toString(), name: student.name }, hasVoted: Boolean(hasVoted) });
    })
    .catch((error) => {
      console.error("Could not load current session:", error);
      if (!response.headersSent) response.status(500).json({ error: "Could not load your session." });
    });
});

server.post("/api/auth/logout", (request, response) => {
  response.clearCookie(sessionCookie, { httpOnly: true, secure: !dev, sameSite: "lax", path: "/" });
  response.json({ loggedOut: true });
});

server.post("/api/votes", requireRole("student"), async (request, response, nextMiddleware) => {
  try {
    if (!ObjectId.isValid(request.session.studentId)) {
      return response.status(401).json({ error: "Your session is invalid. Sign in again." });
    }
    if (!validRatings(request.body?.ratings)) {
      return response.status(400).json({ error: "Choose a valid rating for every subject." });
    }

    const studentId = new ObjectId(request.session.studentId);
    const student = await studentsCollection.findOne({ _id: studentId }, { projection: { name: 1 } });
    if (!student) return response.status(401).json({ error: "Your student record was not found." });

    try {
      await votesCollection.insertOne({
        studentId,
        studentName: student.name,
        ratings: request.body.ratings.map(({ subject, percentage }) => ({ subject, percentage })),
        submittedAt: new Date(),
      });
    } catch (error) {
      if (error?.code === 11000) {
        return response.status(409).json({ error: "A vote has already been submitted for this student." });
      }
      throw error;
    }

    response.status(201).json({ submitted: true });
  } catch (error) {
    nextMiddleware(error);
  }
});

server.get("/api/admin/results", requireRole("admin"), async (request, response, nextMiddleware) => {
  try {
    const [studentsCount, votes] = await Promise.all([
      studentsCollection.countDocuments(),
      votesCollection.find({}, { projection: { ratings: 1 } }).toArray(),
    ]);
    const results = SUBJECTS.map((subject) => {
      const ratings = votes.flatMap((vote) => vote.ratings.filter((rating) => rating.subject === subject));
      const totalPoints = ratings.reduce((total, rating) => total + rating.percentage, 0);
      const distribution = Object.fromEntries(
        RATING_VALUES.map((percentage) => [
          percentage,
          ratings.filter((rating) => rating.percentage === percentage).length,
        ]),
      );
      return {
        subject,
        totalVotes: ratings.length,
        totalPoints,
        average: ratings.length ? totalPoints / ratings.length : 0,
        distribution,
      };
    });
    const ranking = [...results].sort(
      (first, second) => second.average - first.average || first.subject.localeCompare(second.subject),
    );
    response.json({
      totalStudents: studentsCount,
      totalVotes: votes.length,
      participation: studentsCount ? votes.length / studentsCount : 0,
      results,
      ranking,
    });
  } catch (error) {
    nextMiddleware(error);
  }
});

server.get("/api/admin/students", requireRole("admin"), async (request, response, nextMiddleware) => {
  try {
    const [students, votes] = await Promise.all([
      studentsCollection.find({}, { projection: { name: 1, createdAt: 1 } }).sort({ name: 1 }).toArray(),
      votesCollection.find({}, { projection: { studentId: 1, submittedAt: 1 } }).toArray(),
    ]);
    const votesByStudentId = new Map(votes.map((vote) => [vote.studentId.toString(), vote]));
    response.json({
      students: students.map((student) => {
        const vote = votesByStudentId.get(student._id.toString());
        return {
          id: student._id.toString(),
          name: student.name,
          createdAt: student.createdAt,
          vote: vote ? { submittedAt: vote.submittedAt } : null,
        };
      }),
    });
  } catch (error) {
    nextMiddleware(error);
  }
});

server.post("/api/admin/students", requireRole("admin"), async (request, response, nextMiddleware) => {
  try {
    const name = typeof request.body?.name === "string" ? request.body.name.trim().replace(/\s+/g, " ") : "";
    if (!name || name.length > 100) {
      return response.status(400).json({ error: "Enter a name between 1 and 100 characters." });
    }
    const normalizedName = normalizeStudentName(name);
    try {
      const result = await studentsCollection.insertOne({ name, normalizedName, createdAt: new Date() });
      response.status(201).json({ student: { id: result.insertedId.toString(), name } });
    } catch (error) {
      if (error?.code === 11000) return response.status(409).json({ error: "That student is already on the roster." });
      throw error;
    }
  } catch (error) {
    nextMiddleware(error);
  }
});

const nextApp = next({ dev, port });
const nextHandler = nextApp.getRequestHandler();
await nextApp.prepare();

server.use((request, response, nextMiddleware) => {
  if (request.path.startsWith("/api/")) {
    return response.status(404).json({ error: "API route not found." });
  }
  nextHandler(request, response).catch(nextMiddleware);
});

server.use((error, request, response, nextMiddleware) => {
  console.error("Request failed:", error);
  if (response.headersSent) return nextMiddleware(error);
  response.status(500).json({ error: "The server could not complete this request." });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`> Class Voice server listening on port ${port} (${dev ? "development" : "production"})`);
});

async function closeServer() {
  server.close(async () => {
    await client.close();
    process.exit(0);
  });
}

process.on("SIGINT", closeServer);
process.on("SIGTERM", closeServer);
