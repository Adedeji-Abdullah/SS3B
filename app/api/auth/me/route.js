import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  if (session.role === "admin") {
    return NextResponse.json({ role: "admin" });
  }

  const student = await prisma.student.findUnique({
    where: { id: session.id },
    select: { id: true, name: true, vote: { select: { id: true } } },
  });
  if (!student) {
    return NextResponse.json({ error: "Student account no longer exists." }, { status: 401 });
  }

  return NextResponse.json({
    role: "student",
    student: { id: student.id, name: student.name },
    hasVoted: Boolean(student.vote),
  });
}
