import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { normalizeStudentName } from "@/lib/subjects";
import { connectToDatabase } from "@/lib/mongodb";

export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (typeof body?.name !== "string" || !body.name.trim() || body.name.trim().length > 100) {
    return NextResponse.json({ error: "Enter your name (up to 100 characters)." }, { status: 400 });
  }

  const name = body.name.trim().replace(/\s+/g, " ");
  const normalizedName = normalizeStudentName(name);
  const db = await connectToDatabase();
  const students = db.collection("students");
  let student = await students.findOne({ normalizedName });

  if (!student) {
    const candidate = {
      _id: new ObjectId(),
      name,
      normalizedName,
      createdAt: new Date(),
    };

    try {
      await students.insertOne(candidate);
      student = candidate;
    } catch (error) {
      if (error?.code !== 11000) throw error;
      student = await students.findOne({ normalizedName });
    }
  }

  if (!student) {
    return NextResponse.json({ error: "Could not create your student account. Please try again." }, { status: 503 });
  }

  const vote = await db.collection("votes").findOne(
    { studentId: student._id },
    { projection: { _id: 1 } },
  );

  const response = NextResponse.json({
    student: { id: student._id.toString(), name: student.name },
    hasVoted: Boolean(vote),
  });
  response.cookies.set(
    SESSION_COOKIE,
    createSessionToken({ sub: student._id.toString(), role: "student" }),
    sessionCookieOptions(),
  );
  return response;
}
