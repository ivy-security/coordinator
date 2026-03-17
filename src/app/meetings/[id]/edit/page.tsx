"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import MeetingForm, { MeetingFormData, RangeOption } from "@/components/meeting-form";

interface TimeOption {
  id: string;
  startTime: string;
  endTime: string;
  availabilities: { user: { email: string }; slots: string[] }[];
}

interface Participant {
  email: string;
  type: "REQUIRED" | "OPTIONAL";
  hasVoted: boolean;
}

interface MeetingData {
  id: string;
  title: string;
  description: string | null;
  duration: number;
  status: string;
  additionalContext: string | null;
  linkedInUrl: string | null;
  imageUrl: string | null;
  creator: { email: string };
  timeOptions: TimeOption[];
  participants: Participant[];
}

function toRangeOption(to: TimeOption): RangeOption {
  const start = new Date(to.startTime);
  const end = new Date(to.endTime);
  const yyyy = start.getFullYear();
  const mm = String(start.getMonth() + 1).padStart(2, "0");
  const dd = String(start.getDate()).padStart(2, "0");
  const hStart = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
  const hEnd = `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
  return {
    id: to.id,
    date: `${yyyy}-${mm}-${dd}`,
    startTime: hStart,
    endTime: hEnd,
  };
}

export default function EditMeeting() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [meeting, setMeeting] = useState<MeetingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [voidedVotes, setVoidedVotes] = useState<string[]>([]);
  const [showWarning, setShowWarning] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<{ data: MeetingFormData; imageFile: File | null } | null>(null);

  useEffect(() => {
    fetch(`/api/meetings/${id}`)
      .then((r) => r.json())
      .then(setMeeting)
      .finally(() => setLoading(false));
  }, [id]);

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

  function detectVoidedVotes(data: MeetingFormData): string[] {
    if (!meeting) return [];
    const voided: string[] = [];
    const organizerEmail = meeting.creator.email.toLowerCase();

    // Build a set of new range IDs (existing ones that are kept)
    const newRangeIds = new Set(data.ranges.map((r) => r.id));

    for (const to of meeting.timeOptions) {
      if (!newRangeIds.has(to.id)) {
        // This range was removed — all votes on it are voided
        for (const avail of to.availabilities) {
          if (avail.user.email.toLowerCase() !== organizerEmail && !voided.includes(avail.user.email)) {
            voided.push(avail.user.email);
          }
        }
        continue;
      }

      // Range still exists but may have changed — check if any voted slots fall outside new range
      const newRange = data.ranges.find((r) => r.id === to.id);
      if (!newRange || !newRange.date) continue;

      const newStart = new Date(`${newRange.date}T${newRange.startTime}:00`).getTime();
      const newEnd = new Date(`${newRange.date}T${newRange.endTime}:00`).getTime();

      for (const avail of to.availabilities) {
        if (avail.user.email.toLowerCase() === organizerEmail) continue;
        for (const slot of avail.slots) {
          const slotTime = new Date(slot).getTime();
          if (slotTime < newStart || slotTime >= newEnd) {
            if (!voided.includes(avail.user.email)) {
              voided.push(avail.user.email);
            }
            break;
          }
        }
      }
    }

    // Duration change voids all votes
    if (data.duration !== meeting.duration) {
      for (const to of meeting.timeOptions) {
        for (const avail of to.availabilities) {
          if (avail.user.email.toLowerCase() === organizerEmail) continue;
          if (!voided.includes(avail.user.email)) {
            voided.push(avail.user.email);
          }
        }
      }
    }

    return voided;
  }

  const handleSubmit = async (data: MeetingFormData, imageFile: File | null) => {
    const voided = detectVoidedVotes(data);

    if (voided.length > 0 && !showWarning) {
      setVoidedVotes(voided);
      setShowWarning(true);
      setPendingSubmit({ data, imageFile });
      return;
    }

    await doSubmit(data, imageFile);
  };

  const doSubmit = async (data: MeetingFormData, imageFile: File | null) => {
    let imageUrl = data.imageUrl;

    if (imageFile) {
      const formData = new FormData();
      formData.append("file", imageFile);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      imageUrl = uploadData.url;
    }

    const res = await fetch(`/api/meetings/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: data.title,
        description: data.description,
        duration: data.duration,
        requiredEmails: data.requiredEmails,
        optionalEmails: data.optionalEmails,
        additionalContext: data.additionalContext,
        linkedInUrl: data.linkedInUrl,
        imageUrl,
        ranges: data.ranges
          .filter((r) => r.date && r.startTime && r.endTime)
          .map((r) => ({
            id: r.id,
            startTime: new Date(`${r.date}T${r.startTime}:00`).toISOString(),
            endTime: new Date(`${r.date}T${r.endTime}:00`).toISOString(),
          })),
      }),
    });

    if (res.ok) {
      router.push(`/meetings/${id}`);
    }
  };

  const confirmSubmit = async () => {
    if (pendingSubmit) {
      setShowWarning(false);
      await doSubmit(pendingSubmit.data, pendingSubmit.imageFile);
    }
  };

  const initialData: MeetingFormData = {
    title: meeting.title,
    description: meeting.description || "",
    duration: meeting.duration,
    requiredEmails: meeting.participants.filter((p) => p.type === "REQUIRED").map((p) => p.email),
    optionalEmails: meeting.participants.filter((p) => p.type === "OPTIONAL").map((p) => p.email),
    additionalContext: meeting.additionalContext || "",
    linkedInUrl: meeting.linkedInUrl || "",
    imageUrl: meeting.imageUrl || undefined,
    ranges: meeting.timeOptions.map(toRangeOption),
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-stone-900 mb-2">Edit Meeting</h1>
      <p className="text-stone-500 mb-8">Update meeting details. Changing time ranges or duration may void existing votes.</p>

      {showWarning && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-amber-800 mb-1">
                Some votes will be voided
              </h3>
              <p className="text-sm text-amber-700 mb-2">
                The following participants&apos; votes will be invalidated by your changes and they will need to vote again:
              </p>
              <ul className="text-sm text-amber-700 list-disc list-inside mb-3">
                {voidedVotes.map((email) => (
                  <li key={email}>{email}</li>
                ))}
              </ul>
              <div className="flex gap-3">
                <button
                  onClick={confirmSubmit}
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
                >
                  Save Anyway
                </button>
                <button
                  onClick={() => { setShowWarning(false); setPendingSubmit(null); }}
                  className="px-4 py-2 text-sm font-medium text-amber-700 hover:text-amber-900 transition-colors"
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <MeetingForm
        initialData={initialData}
        onSubmit={handleSubmit}
        submitLabel="Save Changes"
        submittingLabel="Saving..."
      />
    </div>
  );
}
