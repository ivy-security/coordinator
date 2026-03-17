import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
