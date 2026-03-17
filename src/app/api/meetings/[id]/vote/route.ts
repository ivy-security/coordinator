import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendCompletionEmail, sendVoteReceivedEmail } from "@/lib/email";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: meetingId } = await params;
  const session = await auth();
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { availabilities } = body as {
    availabilities: { rangeId: string; slots: string[] }[];
  };

  // Verify user is a participant
  const participant = await prisma.participant.findUnique({
    where: {
      meetingId_email: {
        meetingId,
        email: session.user.email.toLowerCase(),
      },
    },
  });

  if (!participant) {
    return NextResponse.json({ error: "You are not a participant" }, { status: 403 });
  }

  // Upsert availabilities in a transaction
  await prisma.$transaction([
    // Upsert all availability records
    ...availabilities.map((a) =>
      prisma.availability.upsert({
        where: {
          userId_rangeId: {
            userId: session.user!.id!,
            rangeId: a.rangeId,
          },
        },
        create: {
          userId: session.user!.id!,
          rangeId: a.rangeId,
          slots: a.slots.map((s) => new Date(s)),
        },
        update: {
          slots: a.slots.map((s) => new Date(s)),
        },
      })
    ),
    // Mark participant as voted
    prisma.participant.update({
      where: { id: participant.id },
      data: { hasVoted: true },
    }),
  ]);

  // Check if all required participants have voted
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      participants: true,
      creator: { select: { email: true } },
    },
  });

  if (meeting && meeting.creator.email) {
    const requiredParticipants = meeting.participants.filter(
      (p) => p.type === "REQUIRED"
    );
    const votedCount = requiredParticipants.filter((p) => p.hasVoted).length;
    const allRequiredVoted = votedCount === requiredParticipants.length;

    const voterName = session.user.name || session.user.email;

    // Notify creator that someone voted
    sendVoteReceivedEmail(
      meeting.creator.email,
      meeting.title,
      voterName,
      votedCount,
      requiredParticipants.length,
      meeting.id
    ).catch(console.error);

    // Notify creator that all required votes are in
    if (allRequiredVoted) {
      sendCompletionEmail(
        meeting.creator.email,
        meeting.title,
        meeting.id
      ).catch(console.error);
    }
  }

  return NextResponse.json({ success: true });
}
