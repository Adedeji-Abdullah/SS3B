import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RATING_VALUES, SUBJECTS } from "@/lib/subjects";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  const [ratings, totalStudents, totalVotes] = await Promise.all([
    prisma.rating.findMany({ select: { subject: true, percentage: true } }),
    prisma.student.count(),
    prisma.vote.count(),
  ]);

  const results = SUBJECTS.map((subject) => {
    const subjectRatings = ratings.filter((rating) => rating.subject === subject);
    const totalPoints = subjectRatings.reduce((sum, rating) => sum + rating.percentage, 0);
    const distribution = Object.fromEntries(
      RATING_VALUES.map((percentage) => [
        percentage,
        subjectRatings.filter((rating) => rating.percentage === percentage).length,
      ]),
    );

    return {
      subject,
      totalVotes: subjectRatings.length,
      totalPoints,
      average: subjectRatings.length ? totalPoints / subjectRatings.length : 0,
      distribution,
    };
  });

  const ranking = [...results].sort(
    (first, second) => second.average - first.average || first.subject.localeCompare(second.subject),
  );

  return NextResponse.json({
    totalStudents,
    totalVotes,
    participation: totalStudents ? totalVotes / totalStudents : 0,
    results,
    ranking,
  });
}
