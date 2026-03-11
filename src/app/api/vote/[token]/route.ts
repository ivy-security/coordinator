import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const meeting = await prisma.meeting.findUnique({
    where: { shareToken: token },
    include: {
      creator: { select: { name: true, email: true, image: true } },
      timeOptions: {
        orderBy: { startTime: "asc" },
      },
      participants: {
        select: { email: true, type: true, hasVoted: true },
      },
    },
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  return NextResponse.json(meeting);
}
