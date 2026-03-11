"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import {
  Calendar,
  Check,
  Loader2,
  Copy,
  CheckCircle2,
  Mail,
  Users,
  Clock,
  Link as LinkIcon,
  ExternalLink,
  Ban,
} from "lucide-react";
import { generateSlotStarts } from "@/lib/time-slots";

interface AvailabilityRecord {
  userId: string;
  rangeId: string;
  slots: string[];
  user: { id: string; name: string; email: string; image: string | null };
}

interface TimeOption {
  id: string;
  startTime: string;
  endTime: string;
  availabilities: AvailabilityRecord[];
}

interface Participant {
  id: string;
  email: string;
  type: "REQUIRED" | "OPTIONAL";
  hasVoted: boolean;
}

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  duration: number;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  shareToken: string;
  additionalContext: string | null;
  linkedInUrl: string | null;
  imageUrl: string | null;
  finalizedStart: string | null;
  finalizedEnd: string | null;
  creator: { name: string; email: string; image: string | null };
  timeOptions: TimeOption[];
  participants: Participant[];
}

interface SlotInfo {
  rangeId: string;
  start: Date;
  end: Date;
  availableCount: number;
  totalRequired: number;
  availableEmails: string[];
}

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [sendingInvites, setSendingInvites] = useState(false);

  useEffect(() => {
    fetch(`/api/meetings/${id}`)
      .then((r) => r.json())
      .then(setMeeting)
      .finally(() => setLoading(false));
  }, [id]);

  const slotData = useMemo(() => {
    if (!meeting) return new Map<string, SlotInfo[]>();

    const requiredParticipants = meeting.participants.filter(
      (p) => p.type === "REQUIRED"
    );
    const requiredEmails = requiredParticipants.map((p) => p.email.toLowerCase());

    const result = new Map<string, SlotInfo[]>();

    for (const range of meeting.timeOptions) {
      const slotStarts = generateSlotStarts(
        new Date(range.startTime),
        new Date(range.endTime),
        meeting.duration
      );

      // Build a map: email -> Set of slot start ISO strings
      const emailSlotMap = new Map<string, Set<string>>();
      for (const avail of range.availabilities) {
        const email = avail.user.email.toLowerCase();
        const slotSet = new Set(
          avail.slots.map((s: string) => new Date(s).toISOString())
        );
        emailSlotMap.set(email, slotSet);
      }

      const slots: SlotInfo[] = slotStarts.map((slotStart) => {
        const slotIso = slotStart.toISOString();
        const availableEmails: string[] = [];

        for (const email of requiredEmails) {
          const userSlots = emailSlotMap.get(email);
          if (userSlots?.has(slotIso)) {
            availableEmails.push(email);
          }
        }

        return {
          rangeId: range.id,
          start: slotStart,
          end: new Date(slotStart.getTime() + meeting.duration * 60 * 1000),
          availableCount: availableEmails.length,
          totalRequired: requiredEmails.length,
          availableEmails,
        };
      });

      result.set(range.id, slots);
    }

    return result;
  }, [meeting]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="text-center py-20">
        <h1 className="text-xl font-bold text-stone-900">Meeting not found</h1>
      </div>
    );
  }

  const shareUrl = `${window.location.origin}/vote/${meeting.shareToken}`;
  const requiredParticipants = meeting.participants.filter((p) => p.type === "REQUIRED");
  const optionalParticipants = meeting.participants.filter((p) => p.type === "OPTIONAL");
  const allRequiredVoted = requiredParticipants.length > 0 && requiredParticipants.every((p) => p.hasVoted);

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendInvites = async () => {
    setSendingInvites(true);
    try {
      await fetch(`/api/meetings/${id}/invite`, { method: "POST" });
    } finally {
      setSendingInvites(false);
    }
  };

  const finalize = async (slotStart: Date, slotEnd: Date) => {
    setFinalizing(true);
    try {
      const res = await fetch(`/api/meetings/${id}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotStart: slotStart.toISOString(),
          slotEnd: slotEnd.toISOString(),
        }),
      });
      if (res.ok) {
        setMeeting((prev) =>
          prev
            ? {
                ...prev,
                status: "COMPLETED",
                finalizedStart: slotStart.toISOString(),
                finalizedEnd: slotEnd.toISOString(),
              }
            : null
        );
      }
    } finally {
      setFinalizing(false);
    }
  };

  const cancel = async () => {
    await fetch(`/api/meetings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    setMeeting((prev) => (prev ? { ...prev, status: "CANCELLED" } : null));
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-stone-900">{meeting.title}</h1>
            {meeting.description && (
              <p className="text-stone-500 mt-1">{meeting.description}</p>
            )}
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-stone-100 text-stone-600 rounded-full text-sm">
              <Clock className="w-3.5 h-3.5" />
              {meeting.duration} min meeting
            </div>
          </div>
          <div className="flex items-center gap-2">
            {meeting.status === "ACTIVE" && (
              <button
                onClick={cancel}
                className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
              >
                <Ban className="w-3.5 h-3.5" />
                Cancel
              </button>
            )}
          </div>
        </div>

        {meeting.status === "COMPLETED" && meeting.finalizedStart && meeting.finalizedEnd && (
          <div className="mt-4 bg-primary-50 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
            <div>
              <p className="font-medium text-primary">Meeting confirmed</p>
              <p className="text-sm text-primary/70">
                {format(new Date(meeting.finalizedStart), "EEEE, MMMM d, yyyy")} &mdash;{" "}
                {format(new Date(meeting.finalizedStart), "h:mm a")} to{" "}
                {format(new Date(meeting.finalizedEnd), "h:mm a")}
              </p>
              <p className="text-sm text-primary/70 mt-0.5">
                Calendar invites have been sent to all participants.
              </p>
            </div>
          </div>
        )}

        {meeting.status === "CANCELLED" && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="font-medium text-red-600">This meeting has been cancelled.</p>
          </div>
        )}
      </div>

      {/* Share link */}
      {meeting.status === "ACTIVE" && (
        <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6">
          <h2 className="text-sm font-medium text-stone-700 mb-3 flex items-center gap-2">
            <LinkIcon className="w-4 h-4" />
            Share Link
          </h2>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={shareUrl}
              className="flex-1 px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-600 select-all"
            />
            <button
              onClick={copyLink}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={sendInvites}
              disabled={sendingInvites}
              className="flex items-center gap-2 px-4 py-2 border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors text-sm font-medium text-stone-700"
            >
              <Mail className="w-4 h-4" />
              {sendingInvites ? "Sending..." : "Send Emails"}
            </button>
          </div>
        </div>
      )}

      {/* Participants */}
      <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6">
        <h2 className="text-sm font-medium text-stone-700 mb-3 flex items-center gap-2">
          <Users className="w-4 h-4" />
          Participants
        </h2>
        <div className="space-y-2">
          {requiredParticipants.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm text-stone-700">{p.email}</span>
                <span className="text-xs px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded">
                  Required
                </span>
              </div>
              {p.hasVoted ? (
                <span className="flex items-center gap-1 text-xs text-primary font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Voted
                </span>
              ) : (
                <span className="text-xs text-stone-400">Waiting</span>
              )}
            </div>
          ))}
          {optionalParticipants.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm text-stone-700">{p.email}</span>
                <span className="text-xs px-1.5 py-0.5 bg-stone-50 text-stone-400 rounded">
                  Optional
                </span>
              </div>
              {p.hasVoted ? (
                <span className="flex items-center gap-1 text-xs text-primary font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Voted
                </span>
              ) : (
                <span className="text-xs text-stone-400">Waiting</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Availability Results — grouped by range */}
      <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6">
        <h2 className="text-sm font-medium text-stone-700 mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Availability Results
        </h2>

        {meeting.timeOptions.map((range) => {
          const slots = slotData.get(range.id) || [];
          const fullyAvailable = slots.filter(
            (s) => s.availableCount === s.totalRequired && s.totalRequired > 0
          );
          const partialSlots = slots.filter(
            (s) => s.availableCount > 0 && s.availableCount < s.totalRequired
          );

          const isFinalizedRange =
            meeting.finalizedStart &&
            slots.some(
              (s) => s.start.toISOString() === new Date(meeting.finalizedStart!).toISOString()
            );

          return (
            <div key={range.id} className="mb-6 last:mb-0">
              <h3 className="font-medium text-stone-900 mb-1">
                {format(new Date(range.startTime), "EEEE, MMMM d, yyyy")}
              </h3>
              <p className="text-xs text-stone-400 mb-3">
                {format(new Date(range.startTime), "h:mm a")} &mdash;{" "}
                {format(new Date(range.endTime), "h:mm a")}
              </p>

              {slots.length === 0 ? (
                <p className="text-sm text-stone-400 italic">No slots in this range.</p>
              ) : (
                <div className="space-y-2">
                  {/* Fully available slots (green) */}
                  {fullyAvailable.map((slot) => {
                    const isFinalized =
                      meeting.finalizedStart &&
                      slot.start.toISOString() === new Date(meeting.finalizedStart).toISOString();

                    return (
                      <div
                        key={slot.start.toISOString()}
                        className={`flex items-center justify-between p-3 rounded-lg border-2 ${
                          isFinalized
                            ? "border-primary bg-primary-50"
                            : "border-green-300 bg-green-50"
                        }`}
                      >
                        <div>
                          <span className="text-sm font-medium text-stone-900">
                            {format(slot.start, "h:mm a")} &mdash; {format(slot.end, "h:mm a")}
                          </span>
                          <span className="ml-2 text-xs text-green-700 font-medium">
                            {slot.availableCount}/{slot.totalRequired} required available
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isFinalized && (
                            <span className="flex items-center gap-1 text-sm font-medium text-primary">
                              <CheckCircle2 className="w-4 h-4" />
                              Confirmed
                            </span>
                          )}
                          {meeting.status === "ACTIVE" && allRequiredVoted && !isFinalized && (
                            <button
                              onClick={() => finalize(slot.start, slot.end)}
                              disabled={finalizing}
                              className="flex items-center gap-1.5 bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium disabled:opacity-50"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              {finalizing ? "..." : "Confirm"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Partial slots (yellow) */}
                  {partialSlots.map((slot) => (
                    <div
                      key={slot.start.toISOString()}
                      className="flex items-center justify-between p-3 rounded-lg border border-amber-200 bg-amber-50"
                    >
                      <div>
                        <span className="text-sm font-medium text-stone-900">
                          {format(slot.start, "h:mm a")} &mdash; {format(slot.end, "h:mm a")}
                        </span>
                        <span className="ml-2 text-xs text-amber-700 font-medium">
                          {slot.availableCount}/{slot.totalRequired} required available
                        </span>
                      </div>
                    </div>
                  ))}

                  {fullyAvailable.length === 0 && partialSlots.length === 0 && (
                    <p className="text-sm text-stone-400 italic">
                      No participants have marked availability in this range yet.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {meeting.status === "ACTIVE" && allRequiredVoted && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              {Array.from(slotData.values()).some((slots) =>
                slots.some((s) => s.availableCount === s.totalRequired && s.totalRequired > 0)
              )
                ? "All required participants have voted. Choose a slot to confirm the meeting."
                : "All required participants have voted, but no slot works for everyone. Consider adding more availability ranges."}
            </p>
          </div>
        )}
      </div>

      {/* Additional context */}
      {(meeting.additionalContext || meeting.linkedInUrl || meeting.imageUrl) && (
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="text-sm font-medium text-stone-700 mb-3">Additional Context</h2>
          {meeting.linkedInUrl && (
            <a
              href={meeting.linkedInUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mb-3"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              LinkedIn Profile
            </a>
          )}
          {meeting.additionalContext && (
            <p className="text-sm text-stone-600 whitespace-pre-wrap mb-3">
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
    </div>
  );
}
