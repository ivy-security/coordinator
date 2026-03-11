"use client";

import { useCallback, useRef, useState } from "react";
import { generateSlotStarts, formatSlotLabel } from "@/lib/time-slots";

interface TimeRangeSelectorProps {
  range: { id: string; startTime: string; endTime: string };
  duration: number;
  selected: string[];
  onChange: (selected: string[]) => void;
}

export default function TimeRangeSelector({
  range,
  duration,
  selected,
  onChange,
}: TimeRangeSelectorProps) {
  const slots = generateSlotStarts(
    new Date(range.startTime),
    new Date(range.endTime),
    duration
  );

  const selectedSet = new Set(selected);
  const dragMode = useRef<"select" | "deselect" | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const toggle = useCallback(
    (isoStr: string) => {
      const next = new Set(selected);
      if (next.has(isoStr)) {
        next.delete(isoStr);
      } else {
        next.add(isoStr);
      }
      onChange(Array.from(next));
    },
    [selected, onChange]
  );

  const handlePointerDown = useCallback(
    (isoStr: string) => {
      setIsDragging(true);
      if (selectedSet.has(isoStr)) {
        dragMode.current = "deselect";
        const next = new Set(selected);
        next.delete(isoStr);
        onChange(Array.from(next));
      } else {
        dragMode.current = "select";
        const next = new Set(selected);
        next.add(isoStr);
        onChange(Array.from(next));
      }
    },
    [selected, selectedSet, onChange]
  );

  const handlePointerEnter = useCallback(
    (isoStr: string) => {
      if (!isDragging || !dragMode.current) return;
      const next = new Set(selected);
      if (dragMode.current === "select") {
        next.add(isoStr);
      } else {
        next.delete(isoStr);
      }
      onChange(Array.from(next));
    },
    [isDragging, selected, onChange]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    dragMode.current = null;
  }, []);

  if (slots.length === 0) {
    return (
      <p className="text-sm text-stone-400 italic">
        No slots fit in this range for the selected duration.
      </p>
    );
  }

  return (
    <div
      className="flex flex-wrap gap-1.5"
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {slots.map((slot) => {
        const iso = slot.toISOString();
        const isSelected = selectedSet.has(iso);
        return (
          <button
            key={iso}
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              handlePointerDown(iso);
            }}
            onPointerEnter={() => handlePointerEnter(iso)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors select-none touch-none ${
              isSelected
                ? "bg-primary text-white border-primary"
                : "bg-white text-stone-600 border-stone-200 hover:border-stone-300"
            }`}
          >
            {formatSlotLabel(slot, duration)}
          </button>
        );
      })}
    </div>
  );
}
