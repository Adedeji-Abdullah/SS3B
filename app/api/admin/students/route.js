import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { normalizeStudentName } from "@/lib/subjects";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  const db = await connectToDatabase();
  const students = await db.collection("students").find(
    {},
    { projection: { name: 1, createdAt: 1 } },
  ).sort({ name: 1 }).toArray();
  const studentIds = students.map((student) => student._id);
  const votes = await db.collection("votes").find(
    { studentId: { $in: studentIds } },
    { projection: { studentId: 1, submittedAt: 1 } },
  ).toArray();
  const votesByStudentId = new Map(votes.map((vote) => [vote.studentId.toString(), vote]));

  return NextResponse.json({
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
}

export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (typeof body?.name !== "string" || !body.name.trim() || body.name.trim().length > 100) {
    return NextResponse.json({ error: "Enter a student name up to 100 characters." }, { status: 400 });
  }

  const name = body.name.trim().replace(/\s+/g, " ");
  const db = await connectToDatabase();
  const student = {
    _id: new ObjectId(),
    name,
    normalizedName: normalizeStudentName(name),
    createdAt: new Date(),
  };
  try {
    await db.collection("students").insertOne(student);
    return NextResponse.json({
      student: { id: student._id.toString(), name: student.name },
    }, { status: 201 });
  } catch (error) {
    if (error?.code === 11000) {
      return NextResponse.json({ error: "A student with that name is already on the roster." }, { status: 409 });
    }
    throw error;
  }
}
