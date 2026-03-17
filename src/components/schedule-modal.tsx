"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Calendar, X, MapPin, Users, FileText, Type, Video } from "lucide-react";

interface ScheduleModalProps {
  meetingTitle: string;
  meetingDescription: string | null;
  slotStart: Date;
  slotEnd: Date;
  attendees: string[];
  organizerEmail: string;
  onConfirm: (data: {
    title: string;
    description: string;
    attendees: string[];
    location: string;
    addGoogleMeet: boolean;
  }) => Promise<void>;
  onClose: () => void;
}

export default function ScheduleModal({
  meetingTitle,
  meetingDescription,
  slotStart,
  slotEnd,
  attendees: initialAttendees,
  organizerEmail,
  onConfirm,
  onClose,
}: ScheduleModalProps) {
  const [title, setTitle] = useState(meetingTitle);
  const [description, setDescription] = useState(meetingDescription || "");
  const [location, setLocation] = useState("");
  const [attendees, setAttendees] = useState<string[]>(() => {
    const all = [organizerEmail, ...initialAttendees];
    return [...new Set(all.map((e) => e.toLowerCase()))];
  });
  const [attendeeInput, setAttendeeInput] = useState("");
  const [addGoogleMeet, setAddGoogleMeet] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const addAttendee = () => {
    const parts = attendeeInput.split(/[,;\s]+/).filter(Boolean);
    const newEmails = parts
      .map((p) => p.trim().toLowerCase())
      .filter((e) => e.includes("@") && !attendees.includes(e));
    if (newEmails.length > 0) {
      setAttendees([...attendees, ...newEmails]);
      setAttendeeInput("");
    }
  };

  const removeAttendee = (email: string) => {
    setAttendees(attendees.filter((a) => a !== email));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "," || e.key === ";") {
      e.preventDefault();
      addAttendee();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onConfirm({ title, description, attendees, location, addGoogleMeet });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <h2 className="text-lg font-semibold text-stone-900">Schedule Meeting</h2>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Time (read-only) */}
          <div className="flex items-center gap-3 p-3 bg-primary-50 rounded-lg">
            <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-stone-900">
                {format(slotStart, "EEEE, MMMM d, yyyy")}
              </p>
              <p className="text-sm text-stone-600">
                {format(slotStart, "h:mm a")} &mdash; {format(slotEnd, "h:mm a")}
              </p>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-stone-700 mb-1.5">
              <Type className="w-3.5 h-3.5" />
              Subject
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-stone-700 mb-1.5">
              <FileText className="w-3.5 h-3.5" />
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none text-sm"
            />
          </div>

          {/* Location */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-stone-700 mb-1.5">
              <MapPin className="w-3.5 h-3.5" />
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Add a location or video link..."
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
            />
          </div>

          {/* Google Meet */}
          <div
            className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
              addGoogleMeet
                ? "border-blue-200 bg-blue-50"
                : "border-stone-200 bg-stone-50"
            }`}
            onClick={() => setAddGoogleMeet(!addGoogleMeet)}
          >
            <div className="flex items-center gap-2.5">
              <Video className={`w-4 h-4 ${addGoogleMeet ? "text-blue-600" : "text-stone-400"}`} />
              <span className={`text-sm font-medium ${addGoogleMeet ? "text-blue-700" : "text-stone-600"}`}>
                Add Google Meet video conferencing
              </span>
            </div>
            <div
              className={`w-9 h-5 rounded-full transition-colors relative ${
                addGoogleMeet ? "bg-blue-500" : "bg-stone-300"
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  addGoogleMeet ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </div>
          </div>

          {/* Attendees */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-stone-700 mb-1.5">
              <Users className="w-3.5 h-3.5" />
              Attendees
            </label>
            <div className="flex flex-wrap gap-1.5 px-3 py-2 border border-stone-300 rounded-lg focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary bg-white min-h-[42px]">
              {attendees.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2 py-1 rounded-md"
                >
                  {email}
                  <button
                    type="button"
                    onClick={() => removeAttendee(email)}
                    className="text-primary/60 hover:text-primary"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={attendeeInput}
                onChange={(e) => setAttendeeInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={addAttendee}
                placeholder={attendees.length === 0 ? "Add attendees..." : ""}
                className="flex-1 min-w-[140px] outline-none text-sm bg-transparent"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim() || attendees.length === 0}
              className="flex items-center gap-1.5 bg-primary text-white px-5 py-2 rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium disabled:opacity-50"
            >
              <Calendar className="w-4 h-4" />
              {submitting ? "Scheduling..." : "Send Invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
