import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  if (session.role === "admin") {
    return NextResponse.json({ role: "admin" });
  }

  if (!ObjectId.isValid(session.id)) {
    return NextResponse.json({ error: "Student session is invalid. Sign in again." }, { status: 401 });
  }

  const db = await connectToDatabase();
  const student = await db.collection("students").findOne(
    { _id: new ObjectId(session.id) },
    { projection: { _id: 1, name: 1 } },
  );
  if (!student) {
    return NextResponse.json({ error: "Student account no longer exists." }, { status: 401 });
  }
  const vote = await db.collection("votes").findOne(
    { studentId: student._id },
    { projection: { _id: 1 } },
  );

  return NextResponse.json({
    role: "student",
    student: { id: student._id.toString(), name: student.name },
    hasVoted: Boolean(vote),
  });
}
