import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: {
      email: { not: session.user.email },
    },
    select: { email: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(users);
}
