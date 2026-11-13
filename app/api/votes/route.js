import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { RATING_VALUES, SUBJECTS } from "@/lib/subjects";

export async function POST(request) {
  const session = await getSession();
  if (!session || session.role !== "student") {
    return NextResponse.json({ error: "Sign in as a student to submit ratings." }, { status: 401 });
  }
  if (!ObjectId.isValid(session.id)) {
    return NextResponse.json({ error: "Student session is invalid. Sign in again." }, { status: 401 });
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
    const db = await connectToDatabase();
    const studentId = new ObjectId(session.id);
    const studentExists = await db.collection("students").findOne(
      { _id: studentId },
      { projection: { _id: 1 } },
    );
    if (!studentExists) {
      return NextResponse.json({ error: "Student account not found. Sign in again." }, { status: 401 });
    }

    const vote = {
      _id: new ObjectId(),
      studentId,
      submittedAt: new Date(),
      ratings: SUBJECTS.map((subject) => ({
        subject,
        percentage: normalizedRatings.get(subject),
      })),
    };
    await db.collection("votes").insertOne(vote);

    return NextResponse.json({
      submitted: true,
      vote: { id: vote._id.toString(), submittedAt: vote.submittedAt },
    }, { status: 201 });
  } catch (error) {
    if (error?.code === 11000) {
      return NextResponse.json({ error: "A vote has already been submitted for this student." }, { status: 409 });
    }

    console.error("Vote submission failed:", error);
    return NextResponse.json(
      { error: "We could not save your ratings right now. Please try again or contact the administrator." },
      { status: 500 },
    );
  }
}
