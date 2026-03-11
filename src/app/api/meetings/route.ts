import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";
import { sendInviteEmail } from "@/lib/email";
import { generateSlotStarts } from "@/lib/time-slots";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    title,
    description,
    duration,
    requiredEmails,
    optionalEmails,
    additionalContext,
    linkedInUrl,
    imageUrl,
    ranges,
  } = body;

  if (!title || !ranges?.length || !requiredEmails?.length || !duration) {
    return NextResponse.json(
      { error: "Title, duration, at least one range, and at least one required participant are required" },
      { status: 400 }
    );
  }

  if (![30, 45, 60, 90, 120].includes(duration)) {
    return NextResponse.json(
      { error: "Duration must be 30, 60, 90, or 120 minutes" },
      { status: 400 }
    );
  }

  // Validate each range fits at least one slot
  for (const range of ranges) {
    const start = new Date(range.startTime);
    const end = new Date(range.endTime);
    const slots = generateSlotStarts(start, end, duration);
    if (slots.length === 0) {
      return NextResponse.json(
        { error: `Range ${range.date || ""} ${range.startTime} - ${range.endTime} is too short for a ${duration}-minute meeting` },
        { status: 400 }
      );
    }
  }

  const shareToken = nanoid(12);

  const meeting = await prisma.meeting.create({
    data: {
      title,
      description,
      duration,
      additionalContext,
      linkedInUrl,
      imageUrl,
      shareToken,
      creatorId: session.user.id,
      timeOptions: {
        create: ranges.map((r: { startTime: string; endTime: string }) => ({
          startTime: new Date(r.startTime),
          endTime: new Date(r.endTime),
        })),
      },
      participants: {
        create: [
          ...requiredEmails.map((email: string) => ({
            email: email.toLowerCase(),
            type: "REQUIRED" as const,
          })),
          ...(optionalEmails || []).map((email: string) => ({
            email: email.toLowerCase(),
            type: "OPTIONAL" as const,
          })),
        ],
      },
    },
    include: {
      timeOptions: true,
      participants: true,
    },
  });

  // Send invite emails (fire and forget)
  const allEmails = [...requiredEmails, ...(optionalEmails || [])];
  for (const email of allEmails) {
    sendInviteEmail(email, title, session.user.name || "Someone", shareToken).catch(
      console.error
    );
  }

  return NextResponse.json(meeting);
}
