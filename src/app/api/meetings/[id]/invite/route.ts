import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendInviteEmail } from "@/lib/email";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: meetingId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: { participants: true },
  });

  if (!meeting || meeting.creatorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Re-send invite emails to all participants
  for (const participant of meeting.participants) {
    sendInviteEmail(
      participant.email,
      meeting.title,
      session.user.name || "Someone",
      meeting.shareToken
    ).catch(console.error);
  }

  return NextResponse.json({ success: true });
}
