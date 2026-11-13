import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RATING_VALUES, SUBJECTS } from "@/lib/subjects";

export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== "student") {
    return NextResponse.json({ error: "Sign in as a student to submit ratings." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const ratings = body?.ratings;
  if (!Array.isArray(ratings) || ratings.length !== SUBJECTS.length) {
    return NextResponse.json({ error: "Submit exactly one rating for every subject." }, { status: 400 });
  }

  const normalizedRatings = new Map();
  for (const rating of ratings) {
    if (
      !rating ||
      typeof rating.subject !== "string" ||
      !SUBJECTS.includes(rating.subject) ||
      !Number.isInteger(rating.percentage) ||
      !RATING_VALUES.includes(rating.percentage) ||
      normalizedRatings.has(rating.subject)
    ) {
      return NextResponse.json({ error: "One or more ratings are invalid." }, { status: 400 });
    }
    normalizedRatings.set(rating.subject, rating.percentage);
  }

  if (SUBJECTS.some((subject) => !normalizedRatings.has(subject))) {
    return NextResponse.json({ error: "Choose one rating for every subject." }, { status: 400 });
  }

  try {
    const vote = await prisma.vote.create({
      data: {
        studentId: session.id,
        ratings: {
          create: SUBJECTS.map((subject) => ({
            subject,
            percentage: normalizedRatings.get(subject),
          })),
        },
      },
      select: { id: true, submittedAt: true },
    });

    return NextResponse.json({ submitted: true, vote }, { status: 201 });
  } catch (error) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "A vote has already been submitted for this student." }, { status: 409 });
    }
    if (error?.code === "P2003") {
      return NextResponse.json({ error: "Student account not found. Sign in again." }, { status: 401 });
    }

    console.error("Vote submission failed:", error);
    return NextResponse.json(
      { error: "We could not save your ratings right now. Please try again or contact the administrator." },
      { status: 500 },
    );
  }
}
