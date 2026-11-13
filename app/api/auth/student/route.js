import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { normalizeStudentName } from "@/lib/subjects";
import { prisma } from "@/lib/prisma";

export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (typeof body?.name !== "string" || !body.name.trim() || body.name.trim().length > 100) {
    return NextResponse.json({ error: "Enter your name (up to 100 characters)." }, { status: 400 });
  }

  const name = body.name.trim().replace(/\s+/g, " ");
  const normalizedName = normalizeStudentName(name);
  const student = await prisma.student.upsert({
    where: { normalizedName },
    create: { name, normalizedName },
    update: {},
    select: { id: true, name: true, vote: { select: { id: true } } },
  });

  const response = NextResponse.json({
    student: { id: student.id, name: student.name },
    hasVoted: Boolean(student.vote),
  });
  response.cookies.set(
    SESSION_COOKIE,
    createSessionToken({ sub: student.id, role: "student" }),
    sessionCookieOptions(),
  );
  return response;
}
