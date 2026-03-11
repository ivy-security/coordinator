"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Upload, X } from "lucide-react";
import { generateSlotStarts } from "@/lib/time-slots";
import ParticipantInput from "@/components/participant-input";

interface RangeOption {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
}

const DURATION_OPTIONS = [30, 45, 60, 90, 120];

function buildTimeOptions(): string[] {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const hh = h.toString().padStart(2, "0");
      const mm = m.toString().padStart(2, "0");
      options.push(`${hh}:${mm}`);
    }
  }
  return options;
}

const TIME_OPTIONS = buildTimeOptions();

export default function NewMeeting() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(60);
  const [requiredEmails, setRequiredEmails] = useState<string[]>([]);
  const [optionalEmails, setOptionalEmails] = useState<string[]>([]);
  const [additionalContext, setAdditionalContext] = useState("");
  const [linkedInUrl, setLinkedInUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ranges, setRanges] = useState<RangeOption[]>([
    { id: "1", date: "", startTime: "09:00", endTime: "17:00" },
  ]);

  const addRange = () => {
    setRanges([
      ...ranges,
      { id: Date.now().toString(), date: "", startTime: "09:00", endTime: "17:00" },
    ]);
  };

  const removeRange = (id: string) => {
    if (ranges.length > 1) {
      setRanges(ranges.filter((r) => r.id !== id));
    }
  };

  const updateRange = (id: string, field: keyof RangeOption, value: string) => {
    setRanges(ranges.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const getSlotCount = (range: RangeOption): number | null => {
    if (!range.date || !range.startTime || !range.endTime) return null;
    const start = new Date(`${range.date}T${range.startTime}:00`);
    const end = new Date(`${range.date}T${range.endTime}:00`);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return 0;
    return generateSlotStarts(start, end, duration).length;
  };

  const totalSlots = useMemo(() => {
    return ranges.reduce((sum, r) => sum + (getSlotCount(r) || 0), 0);
  }, [ranges, duration]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
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
          title,
          description,
          duration,
          requiredEmails,
          optionalEmails,
          additionalContext,
          linkedInUrl,
          imageUrl,
          ranges: ranges
            .filter((r) => r.date && r.startTime && r.endTime)
            .map((r) => ({
              startTime: new Date(`${r.date}T${r.startTime}:00`).toISOString(),
              endTime: new Date(`${r.date}T${r.endTime}:00`).toISOString(),
            })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/meetings/${data.id}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-stone-900 mb-2">New Meeting</h1>
      <p className="text-stone-500 mb-8">Set availability ranges and invite participants to mark their free slots</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">
            Meeting Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Q2 Planning Review"
            className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this meeting about?"
            rows={3}
            className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
          />
        </div>

        {/* Duration */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">
            Meeting Duration <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            {DURATION_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(d)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  duration === d
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-stone-600 border-stone-300 hover:border-stone-400"
                }`}
              >
                {d} min
              </button>
            ))}
          </div>
        </div>

        {/* Availability Ranges */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">
            Availability Ranges <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-stone-400 mb-3">
            Set date &amp; time windows. Participants will mark specific {duration}-minute slots within these ranges.
          </p>
          <div className="space-y-3">
            {ranges.map((range, index) => {
              const slotCount = getSlotCount(range);
              return (
                <div key={range.id} className="bg-white p-3 rounded-lg border border-stone-200">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-stone-400 w-6">#{index + 1}</span>
                    <div className="flex-1 grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-stone-400 mb-1">Date</label>
                        <input
                          type="date"
                          required
                          value={range.date}
                          onChange={(e) => updateRange(range.id, "date", e.target.value)}
                          className="w-full px-3 py-2 border border-stone-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-stone-400 mb-1">Start</label>
                        <select
                          value={range.startTime}
                          onChange={(e) => updateRange(range.id, "startTime", e.target.value)}
                          className="w-full px-3 py-2 border border-stone-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        >
                          {TIME_OPTIONS.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-stone-400 mb-1">End</label>
                        <select
                          value={range.endTime}
                          onChange={(e) => updateRange(range.id, "endTime", e.target.value)}
                          className="w-full px-3 py-2 border border-stone-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        >
                          {TIME_OPTIONS.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRange(range.id)}
                      className="text-stone-300 hover:text-red-500 transition-colors"
                      disabled={ranges.length === 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {slotCount !== null && (
                    <div className="mt-2 ml-9">
                      <span className={`text-xs ${slotCount > 0 ? "text-primary" : "text-red-500"}`}>
                        {slotCount > 0
                          ? `${slotCount} possible slot${slotCount !== 1 ? "s" : ""}`
                          : "Range too short for selected duration"}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-3">
            <button
              type="button"
              onClick={addRange}
              className="flex items-center gap-2 text-sm text-primary hover:text-primary-dark transition-colors font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Range
            </button>
            {totalSlots > 0 && (
              <span className="text-xs text-stone-500">
                {totalSlots} total slot{totalSlots !== 1 ? "s" : ""} across all ranges
              </span>
            )}
          </div>
        </div>

        {/* Required Participants */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">
            Required Participants <span className="text-red-500">*</span>
          </label>
          <ParticipantInput
            emails={requiredEmails}
            onChange={setRequiredEmails}
            placeholder="Type a name or email..."
            required
          />
        </div>

        {/* Optional Participants */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1.5">
            Optional Participants
          </label>
          <ParticipantInput
            emails={optionalEmails}
            onChange={setOptionalEmails}
            placeholder="Type a name or email..."
          />
        </div>

        {/* Additional Context */}
        <div className="border-t border-stone-200 pt-6">
          <h2 className="text-sm font-medium text-stone-700 mb-4">Additional Context (optional)</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-stone-500 mb-1">LinkedIn Profile</label>
              <input
                type="url"
                value={linkedInUrl}
                onChange={(e) => setLinkedInUrl(e.target.value)}
                placeholder="https://linkedin.com/in/..."
                className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-stone-500 mb-1">
                Context Notes (email snippets, background info, etc.)
              </label>
              <textarea
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                placeholder="Paste relevant email content, notes, or any background information..."
                rows={4}
                className="w-full px-4 py-2.5 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-stone-500 mb-1">Attachment (image)</label>
              {imagePreview ? (
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-h-40 rounded-lg border border-stone-200"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-stone-300 rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                  <Upload className="w-4 h-4 text-stone-400" />
                  <span className="text-sm text-stone-400">Upload an image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-4 pt-4">
          <button
            type="submit"
            disabled={loading || totalSlots === 0}
            className="bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary-dark transition-colors font-medium disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Meeting"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="text-stone-500 hover:text-stone-700 transition-colors font-medium"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
