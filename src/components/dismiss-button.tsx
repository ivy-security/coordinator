"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export default function DismissButton({
  meetingId,
  meetingTitle,
  variant = "icon",
}: {
  meetingId: string;
  meetingTitle: string;
  variant?: "icon" | "text";
}) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const openModal = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowModal(true);
  };

  const dismiss = async () => {
    setDismissing(true);
    const res = await fetch(`/api/meetings/${meetingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DISMISSED" }),
    });
    if (res.ok) {
      setShowModal(false);
      if (variant === "text") {
        router.push("/");
      }
      router.refresh();
    }
    setDismissing(false);
  };

  return (
    <>
      {variant === "icon" ? (
        <button
          onClick={openModal}
          className="text-stone-300 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50"
          title="Dismiss meeting"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ) : (
        <button
          onClick={openModal}
          className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Dismiss
        </button>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowModal(false);
          }}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-stone-900 mb-2">
              Dismiss meeting?
            </h3>
            <p className="text-sm text-stone-500 mb-6">
              Are you sure you want to dismiss <strong>{meetingTitle}</strong>? It will be hidden from your meetings list.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={dismiss}
                disabled={dismissing}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {dismissing ? "Dismissing..." : "Dismiss"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
