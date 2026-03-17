"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MeetingForm, { MeetingFormData } from "@/components/meeting-form";

export default function NewMeeting() {
  const router = useRouter();
  const [defaultEmails, setDefaultEmails] = useState<string[] | null>(null);

  useEffect(() => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((users: { email: string }[]) => {
        setDefaultEmails(users.map((u) => u.email));
      })
      .catch(() => setDefaultEmails([]));
  }, []);

  const handleSubmit = async (data: MeetingFormData, imageFile: File | null) => {
    let imageUrl: string | undefined;

    if (imageFile) {
      const formData = new FormData();
      formData.append("file", imageFile);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      imageUrl = uploadData.url;
    }

    const res = await fetch("/api/meetings", {
      method: "POST",
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
            startTime: new Date(`${r.date}T${r.startTime}:00`).toISOString(),
            endTime: new Date(`${r.date}T${r.endTime}:00`).toISOString(),
          })),
      }),
    });

    if (res.ok) {
      const result = await res.json();
      router.push(`/meetings/${result.id}`);
    }
  };

  if (defaultEmails === null) return null;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-stone-900 mb-2">New Meeting</h1>
      <p className="text-stone-500 mb-8">Set availability ranges and invite participants to mark their free slots</p>
      <MeetingForm
        initialData={{ title: "", description: "", duration: 60, requiredEmails: defaultEmails, optionalEmails: [], additionalContext: "", linkedInUrl: "", ranges: [{ id: "1", date: "", startTime: "09:00", endTime: "17:00" }] }}
        onSubmit={handleSubmit}
        submitLabel="Create Meeting"
        submittingLabel="Creating..."
      />
    </div>
  );
}
