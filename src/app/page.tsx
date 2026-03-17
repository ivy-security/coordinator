import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Calendar, Plus, Users, Clock, CheckCircle2, XCircle, Pencil } from "lucide-react";
import DismissButton from "@/components/dismiss-button";

export default async function Home() {
  const session = await auth();

  if (!session) {
    return <LandingPage />;
  }

  const myMeetings = await prisma.meeting.findMany({
    where: { creatorId: session.user!.id, status: { in: ["ACTIVE", "COMPLETED", "CANCELLED"] } },
    include: {
      timeOptions: true,
      participants: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const userEmail = session.user?.email?.toLowerCase();
  const invitedMeetings = userEmail
    ? await prisma.meeting.findMany({
        where: {
          participants: { some: { email: userEmail } },
          creatorId: { not: session.user!.id },
          status: { in: ["ACTIVE", "COMPLETED", "CANCELLED"] },
        },
        include: {
          timeOptions: true,
          participants: true,
          creator: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const noMeetings = myMeetings.length === 0 && invitedMeetings.length === 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-900">Your Meetings</h1>
        <p className="text-stone-500 mt-1">Manage and track your meeting coordination</p>
      </div>

      {noMeetings ? (
        <div className="text-center py-16 bg-white rounded-xl border border-stone-200">
          <Calendar className="w-12 h-12 text-stone-300 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-stone-600 mb-2">No meetings yet</h2>
          <p className="text-stone-400">Create your first meeting to start coordinating</p>
        </div>
      ) : (
        <>
          {myMeetings.length > 0 && (
            <div className="mb-8">
              {invitedMeetings.length > 0 && (
                <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide mb-3">Organized by you</h2>
              )}
              <div className="grid gap-4">
                {myMeetings.map((meeting) => (
                  <MeetingCard key={meeting.id} meeting={meeting} isOrganizer />
                ))}
              </div>
            </div>
          )}

          {invitedMeetings.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide mb-3">Invited</h2>
              <div className="grid gap-4">
                {invitedMeetings.map((meeting) => (
                  <MeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    isOrganizer={false}
                    organizerName={meeting.creator.name || meeting.creator.email}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MeetingCard({
  meeting,
  isOrganizer,
  organizerName,
}: {
  meeting: {
    id: string;
    title: string;
    description: string | null;
    duration: number;
    status: string;
    timeOptions: { id: string }[];
    participants: { type: string; hasVoted: boolean }[];
  };
  isOrganizer: boolean;
  organizerName?: string;
}) {
  const requiredParticipants = meeting.participants.filter((p) => p.type === "REQUIRED");
  const votedCount = requiredParticipants.filter((p) => p.hasVoted).length;
  const allVoted = requiredParticipants.length > 0 && votedCount === requiredParticipants.length;

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 hover:border-primary/30 hover:shadow-sm transition-all group relative">
      <Link href={`/meetings/${meeting.id}`} className="absolute inset-0 rounded-xl" />
      <div className="flex items-start justify-between relative">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-lg font-semibold text-stone-900 group-hover:text-primary transition-colors">
              {meeting.title}
            </h2>
            <StatusBadge status={meeting.status} allVoted={allVoted} />
          </div>
          {organizerName && (
            <p className="text-xs text-stone-400 mb-2">
              Organized by {organizerName}
            </p>
          )}
          {meeting.description && (
            <p className="text-stone-500 text-sm mb-3 line-clamp-2">
              {meeting.description}
            </p>
          )}
          <div className="flex items-center gap-4 text-sm text-stone-400">
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {meeting.participants.length} participant{meeting.participants.length !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {meeting.duration} min &middot; {meeting.timeOptions.length} range{meeting.timeOptions.length !== 1 ? "s" : ""}
            </span>
            <span>
              {votedCount}/{requiredParticipants.length} required voted
            </span>
          </div>
        </div>
        {isOrganizer && (
          <div className="relative z-10 flex items-center gap-2">
            <Link
              href={`/meetings/${meeting.id}/edit`}
              className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-primary transition-colors px-3 py-1.5 rounded-lg hover:bg-primary-50"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </Link>
            <DismissButton meetingId={meeting.id} meetingTitle={meeting.title} variant="text" />
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status, allVoted }: { status: string; allVoted: boolean }) {
  if (status === "COMPLETED") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-primary-50 text-primary">
        <CheckCircle2 className="w-3 h-3" />
        Confirmed
      </span>
    );
  }
  if (status === "CANCELLED") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-red-50 text-red-600">
        <XCircle className="w-3 h-3" />
        Cancelled
      </span>
    );
  }
  if (allVoted) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-600">
        Ready to finalize
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600">
      Voting in progress
    </span>
  );
}

function LandingPage() {
  return (
    <div className="text-center py-20">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-50 mb-6">
        <Calendar className="w-8 h-8 text-primary" />
      </div>
      <h1 className="text-4xl font-bold text-stone-900 mb-4">
        Meeting Coordinator
      </h1>
      <p className="text-lg text-stone-500 max-w-lg mx-auto mb-8">
        Stop the back-and-forth. Set availability ranges, let participants mark
        their free slots, and lock in the perfect time — all in one place.
      </p>
      <div className="flex items-center justify-center gap-4">
        <Link
          href="/api/auth/signin"
          className="bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary-dark transition-colors font-medium text-lg"
        >
          Get Started
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-8 mt-20 max-w-3xl mx-auto text-left">
        <div className="bg-white p-6 rounded-xl border border-stone-200">
          <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center mb-4">
            <Plus className="w-5 h-5 text-primary" />
          </div>
          <h3 className="font-semibold text-stone-900 mb-2">Create</h3>
          <p className="text-sm text-stone-500">
            Set a meeting duration and availability ranges, then invite participants.
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-stone-200">
          <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center mb-4">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <h3 className="font-semibold text-stone-900 mb-2">Vote</h3>
          <p className="text-sm text-stone-500">
            Participants mark specific time slots where they&apos;re available.
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-stone-200">
          <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-5 h-5 text-primary" />
          </div>
          <h3 className="font-semibold text-stone-900 mb-2">Confirm</h3>
          <p className="text-sm text-stone-500">
            Pick from overlapping slots and a calendar event is created automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
