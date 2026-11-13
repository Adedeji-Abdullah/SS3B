import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeStudentName } from "@/lib/subjects";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  const students = await prisma.student.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      vote: { select: { submittedAt: true } },
    },
  });
  return NextResponse.json({ students });
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
  try {
    const student = await prisma.student.create({
      data: { name, normalizedName: normalizeStudentName(name) },
      select: { id: true, name: true },
    });
    return NextResponse.json({ student }, { status: 201 });
  } catch (error) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "A student with that name is already on the roster." }, { status: 409 });
    }
    throw error;
  }
}
