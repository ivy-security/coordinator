import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateSlotStarts } from "@/lib/time-slots";
import { sendMeetingEditedEmail, sendRevoteRequiredEmail } from "@/lib/email";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: {
      creator: { select: { name: true, email: true, image: true } },
      timeOptions: {
        include: {
          availabilities: {
            include: {
              user: { select: { id: true, name: true, email: true, image: true } },
            },
          },
        },
        orderBy: { startTime: "asc" },
      },
      participants: true,
    },
  });

  if (!meeting) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(meeting);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meeting = await prisma.meeting.findUnique({ where: { id } });
  if (!meeting || meeting.creatorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const allowedStatuses = ["ACTIVE", "COMPLETED", "CANCELLED", "DISMISSED"];
  const data: Record<string, unknown> = {};
  if (body.status && allowedStatuses.includes(body.status)) {
    data.status = body.status;
  }

  const updated = await prisma.meeting.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: {
      timeOptions: { include: { availabilities: true } },
      participants: true,
    },
  });

  if (!meeting || meeting.creatorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
  } = body as {
    title: string;
    description: string;
    duration: number;
    requiredEmails: string[];
    optionalEmails: string[];
    additionalContext: string;
    linkedInUrl: string;
    imageUrl?: string;
    ranges: { id: string; startTime: string; endTime: string }[];
  };

  // Determine which existing timeOptions are kept, removed, or modified
  const incomingRangeIds = new Set(ranges.map((r) => r.id));
  const removedTimeOptionIds = meeting.timeOptions
    .filter((to) => !incomingRangeIds.has(to.id))
    .map((to) => to.id);

  // Detect which ranges changed (time shifted) or if duration changed
  const durationChanged = duration !== meeting.duration;
  const modifiedRangeIds: string[] = [];
  for (const incoming of ranges) {
    const existing = meeting.timeOptions.find((to) => to.id === incoming.id);
    if (existing) {
      const existStart = existing.startTime.toISOString();
      const existEnd = existing.endTime.toISOString();
      if (existStart !== incoming.startTime || existEnd !== incoming.endTime) {
        modifiedRangeIds.push(incoming.id);
      }
    }
  }

  // IDs of ranges whose votes need to be wiped
  const voidedRangeIds = new Set([
    ...removedTimeOptionIds,
    ...modifiedRangeIds,
    ...(durationChanged ? meeting.timeOptions.map((to) => to.id) : []),
  ]);

  // Collect participant emails whose votes are voided
  const voidedParticipantEmails = new Set<string>();
  for (const to of meeting.timeOptions) {
    if (voidedRangeIds.has(to.id)) {
      for (const avail of to.availabilities) {
        // Find participant email by userId
        const userRecord = await prisma.user.findUnique({
          where: { id: avail.userId },
          select: { email: true },
        });
        if (userRecord) {
          voidedParticipantEmails.add(userRecord.email.toLowerCase());
        }
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    // 1. Update meeting fields
    await tx.meeting.update({
      where: { id },
      data: {
        title,
        description,
        duration,
        additionalContext,
        linkedInUrl,
        imageUrl,
        // Reset status to ACTIVE if it was COMPLETED (re-editing a scheduled meeting)
        ...(meeting.status === "COMPLETED" && {
          status: "ACTIVE",
          finalizedStart: null,
          finalizedEnd: null,
          finalizedAttendees: [],
        }),
      },
    });

    // 2. Delete removed timeOptions (cascades to availabilities)
    if (removedTimeOptionIds.length > 0) {
      await tx.timeOption.deleteMany({
        where: { id: { in: removedTimeOptionIds } },
      });
    }

    // 3. Update modified timeOptions and wipe their availabilities
    for (const incoming of ranges) {
      const existing = meeting.timeOptions.find((to) => to.id === incoming.id);
      if (existing) {
        if (modifiedRangeIds.includes(incoming.id) || durationChanged) {
          // Delete old availabilities
          await tx.availability.deleteMany({ where: { rangeId: incoming.id } });
          // Update range times
          await tx.timeOption.update({
            where: { id: incoming.id },
            data: {
              startTime: new Date(incoming.startTime),
              endTime: new Date(incoming.endTime),
            },
          });
          // Re-create creator availability for this range
          const slots = generateSlotStarts(
            new Date(incoming.startTime),
            new Date(incoming.endTime),
            duration
          );
          await tx.availability.create({
            data: {
              userId: session.user!.id!,
              rangeId: incoming.id,
              slots,
            },
          });
        }
      } else {
        // New range — create it
        const newTo = await tx.timeOption.create({
          data: {
            meetingId: id,
            startTime: new Date(incoming.startTime),
            endTime: new Date(incoming.endTime),
          },
        });
        // Create creator availability
        const slots = generateSlotStarts(
          new Date(incoming.startTime),
          new Date(incoming.endTime),
          duration
        );
        await tx.availability.create({
          data: {
            userId: session.user!.id!,
            rangeId: newTo.id,
            slots,
          },
        });
      }
    }

    // 4. Reset hasVoted for voided participants
    if (voidedParticipantEmails.size > 0) {
      await tx.participant.updateMany({
        where: {
          meetingId: id,
          email: { in: Array.from(voidedParticipantEmails) },
        },
        data: { hasVoted: false },
      });
    }

    // 5. Sync participants — delete removed, add new, update types
    const allNewEmails = [
      ...requiredEmails.map((e: string) => ({ email: e.toLowerCase(), type: "REQUIRED" as const })),
      ...(optionalEmails || []).map((e: string) => ({ email: e.toLowerCase(), type: "OPTIONAL" as const })),
    ];
    const newEmailSet = new Set(allNewEmails.map((p) => p.email));
    const existingEmailSet = new Set(meeting.participants.map((p) => p.email));

    // Remove participants no longer in list
    const toRemove = meeting.participants.filter((p) => !newEmailSet.has(p.email));
    if (toRemove.length > 0) {
      await tx.participant.deleteMany({
        where: { id: { in: toRemove.map((p) => p.id) } },
      });
    }

    // Add new participants
    const toAdd = allNewEmails.filter((p) => !existingEmailSet.has(p.email));
    if (toAdd.length > 0) {
      await tx.participant.createMany({
        data: toAdd.map((p) => ({
          meetingId: id,
          email: p.email,
          type: p.type,
        })),
      });
    }

    // Update type for existing participants if changed
    for (const newP of allNewEmails) {
      const existing = meeting.participants.find((p) => p.email === newP.email);
      if (existing && existing.type !== newP.type) {
        await tx.participant.update({
          where: { id: existing.id },
          data: { type: newP.type },
        });
      }
    }
  });

  // Send emails after transaction completes
  const organizerName = session.user.name || session.user.email || "Someone";
  const organizerEmail = session.user.email!.toLowerCase();

  // All current participant emails (excluding organizer)
  const allParticipantEmails = [
    ...requiredEmails.map((e: string) => e.toLowerCase()),
    ...(optionalEmails || []).map((e: string) => e.toLowerCase()),
  ].filter((e: string) => e !== organizerEmail);

  // Rule 6: Send revote emails to voided participants (excluding organizer)
  const voidedNonOrganizer = Array.from(voidedParticipantEmails).filter(
    (e) => e !== organizerEmail
  );
  for (const email of voidedNonOrganizer) {
    sendRevoteRequiredEmail(email, title, organizerName, meeting.shareToken).catch(console.error);
  }

  // Rule 5: Send update to all non-voided participants (they weren't already notified above)
  const nonVoidedParticipants = allParticipantEmails.filter(
    (e: string) => !voidedParticipantEmails.has(e)
  );
  for (const email of nonVoidedParticipants) {
    sendMeetingEditedEmail(email, title, organizerName, meeting.shareToken).catch(console.error);
  }

  return NextResponse.json({ success: true });
}
