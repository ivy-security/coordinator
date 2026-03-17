import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCalendarEvent } from "@/lib/calendar";
import { sendFinalizedEmail } from "@/lib/email";

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

  const body = await req.json();
  const { slotStart, slotEnd, title, description, attendees, location, addGoogleMeet } = body;

  if (!slotStart || !slotEnd) {
    return NextResponse.json({ error: "slotStart and slotEnd are required" }, { status: 400 });
  }

  const startTime = new Date(slotStart);
  const endTime = new Date(slotEnd);
  const eventTitle = title || meeting.title;
  const eventDescription = description ?? meeting.description;
  const eventAttendees: string[] = attendees || meeting.participants.map((p) => p.email);

  // Update meeting status
  await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      status: "COMPLETED",
      finalizedStart: startTime,
      finalizedEnd: endTime,
      finalizedAttendees: eventAttendees,
    },
  });

  // Create Google Calendar event
  try {
    await createCalendarEvent(
      session.user.id,
      eventTitle,
      eventDescription,
      startTime,
      endTime,
      eventAttendees,
      location,
      addGoogleMeet
    );
  } catch (error) {
    console.error("Failed to create calendar event:", error);
  }

  // Send finalized emails
  const startStr = startTime.toLocaleString();
  const endStr = endTime.toLocaleString();
  for (const email of eventAttendees) {
    sendFinalizedEmail(email, eventTitle, startStr, endStr).catch(
      console.error
    );
  }

  return NextResponse.json({ success: true });
}
