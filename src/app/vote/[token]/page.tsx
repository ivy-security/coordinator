"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession, signIn } from "next-auth/react";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { Calendar, Loader2, CheckCircle2, ExternalLink, Clock } from "lucide-react";
import TimeRangeSelector from "@/components/time-range-selector";

interface TimeOption {
  id: string;
  startTime: string;
  endTime: string;
}

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  duration: number;
  additionalContext: string | null;
  linkedInUrl: string | null;
  imageUrl: string | null;
  status: string;
  creator: { name: string; email: string; image: string | null };
  timeOptions: TimeOption[];
  participants: { email: string; type: string; hasVoted: boolean }[];
}

export default function VotePage() {
  const { token } = useParams<{ token: string }>();
  const { data: session, status: authStatus } = useSession();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/vote/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setMeeting(data);
          // Initialize empty selections for each range
          const initial: Record<string, string[]> = {};
          data.timeOptions.forEach((t: TimeOption) => {
            initial[t.id] = [];
          });
          setSelections(initial);
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  const updateSelection = useCallback(
    (rangeId: string, slots: string[]) => {
      setSelections((prev) => ({ ...prev, [rangeId]: slots }));
    },
    []
  );

  if (loading || authStatus === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <h1 className="text-xl font-bold text-stone-900 mb-2">Meeting not found</h1>
        <p className="text-stone-500">This link may be invalid or expired.</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-20 max-w-md mx-auto">
        <Calendar className="w-12 h-12 text-primary mx-auto mb-4" />
        <h1 className="text-xl font-bold text-stone-900 mb-2">
          You&apos;re invited to vote
        </h1>
        <p className="text-stone-500 mb-6">
          Sign in with Google to mark your availability for{" "}
          <strong>{meeting?.title}</strong>
        </p>
        <button
          onClick={() => signIn("google")}
          className="bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary-dark transition-colors font-medium"
        >
          Sign In to Vote
        </button>
      </div>
    );
  }

  if (!meeting) return null;

  // Check if user already voted
  const userParticipant = meeting.participants.find(
    (p) => p.email.toLowerCase() === session.user?.email?.toLowerCase()
  );

  if (userParticipant?.hasVoted || submitted) {
    return (
      <div className="text-center py-20 max-w-md mx-auto">
        <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-4" />
        <h1 className="text-xl font-bold text-stone-900 mb-2">Availability Submitted</h1>
        <p className="text-stone-500">
          {submitted
            ? "Your availability has been recorded. You'll be notified when the meeting is confirmed."
            : "You've already submitted your availability for this meeting."}
        </p>
      </div>
    );
  }

  if (!userParticipant) {
    return (
      <div className="text-center py-20 max-w-md mx-auto">
        <h1 className="text-xl font-bold text-stone-900 mb-2">Not a Participant</h1>
        <p className="text-stone-500">
          Your email ({session.user?.email}) is not on the participant list for this meeting.
        </p>
      </div>
    );
  }

  if (meeting.status === "COMPLETED") {
    return (
      <div className="text-center py-20 max-w-md mx-auto">
        <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-4" />
        <h1 className="text-xl font-bold text-stone-900 mb-2">Meeting Confirmed</h1>
        <p className="text-stone-500">
          This meeting has already been finalized. Check your calendar for the invite.
        </p>
      </div>
    );
  }

  const totalSelected = Object.values(selections).reduce(
    (sum, slots) => sum + slots.length,
    0
  );

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const availabilities = Object.entries(selections).map(
        ([rangeId, slots]) => ({ rangeId, slots })
      );

      const res = await fetch(`/api/meetings/${meeting.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availabilities }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        setError(data.error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center">
            <Calendar className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm text-stone-500">
            {meeting.creator.name} invited you to mark your availability
          </span>
        </div>
        <h1 className="text-2xl font-bold text-stone-900 mt-3">{meeting.title}</h1>
        {meeting.description && (
          <p className="text-stone-500 mt-2">{meeting.description}</p>
        )}
        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary rounded-full text-sm font-medium">
          <Clock className="w-3.5 h-3.5" />
          {meeting.duration} min meeting
        </div>
      </div>

      {/* Additional context */}
      {(meeting.additionalContext || meeting.linkedInUrl || meeting.imageUrl) && (
        <div className="bg-stone-50 rounded-xl p-5 mb-8 space-y-3">
          <h3 className="text-sm font-medium text-stone-600">Context</h3>
          {meeting.linkedInUrl && (
            <a
              href={meeting.linkedInUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              LinkedIn Profile
            </a>
          )}
          {meeting.additionalContext && (
            <p className="text-sm text-stone-600 whitespace-pre-wrap">
              {meeting.additionalContext}
            </p>
          )}
          {meeting.imageUrl && (
            <img
              src={meeting.imageUrl}
              alt="Meeting context"
              className="max-h-60 rounded-lg border border-stone-200"
            />
          )}
        </div>
      )}

      {/* Availability ranges */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-stone-700 mb-1">
          Select the {meeting.duration}-minute slots where you&apos;re available
        </h2>
        <p className="text-xs text-stone-400 mb-4">
          Click to toggle individual slots, or click and drag to select multiple
        </p>
        <div className="space-y-4">
          {meeting.timeOptions.map((range) => (
            <div
              key={range.id}
              className="bg-white rounded-xl border border-stone-200 p-4"
            >
              <h3 className="font-medium text-stone-900 mb-1">
                {format(new Date(range.startTime), "EEEE, MMMM d, yyyy")}
              </h3>
              <p className="text-xs text-stone-400 mb-3">
                {format(new Date(range.startTime), "h:mm a")} &mdash;{" "}
                {format(new Date(range.endTime), "h:mm a")}
              </p>
              <TimeRangeSelector
                range={range}
                duration={meeting.duration}
                selected={selections[range.id] || []}
                onChange={(slots) => updateSelection(range.id, slots)}
              />
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting || totalSelected === 0}
        className="w-full bg-primary text-white py-3 rounded-lg hover:bg-primary-dark transition-colors font-medium disabled:opacity-50"
      >
        {submitting
          ? "Submitting..."
          : `Submit Availability (${totalSelected} slot${totalSelected !== 1 ? "s" : ""} selected)`}
      </button>
    </div>
  );
}
