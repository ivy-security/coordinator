/**
 * Generate all valid slot start times within a range for a given meeting duration.
 * Slots snap to :00/:30 boundaries. The last start must fit the full duration before range end.
 */
export function generateSlotStarts(
  rangeStart: Date,
  rangeEnd: Date,
  durationMinutes: number
): Date[] {
  const slots: Date[] = [];

  // Snap rangeStart up to next :00 or :30
  const start = new Date(rangeStart);
  const startMinutes = start.getMinutes();
  if (startMinutes > 0 && startMinutes < 30) {
    start.setMinutes(30, 0, 0);
  } else if (startMinutes > 30) {
    start.setHours(start.getHours() + 1, 0, 0, 0);
  } else {
    start.setSeconds(0, 0);
  }

  const endTime = rangeEnd.getTime();

  let current = new Date(start);
  while (current.getTime() + durationMinutes * 60 * 1000 <= endTime) {
    slots.push(new Date(current));
    current = new Date(current.getTime() + 30 * 60 * 1000);
  }

  return slots;
}

/**
 * Format a slot for display: "9:00 – 10:00" style
 */
export function formatSlotLabel(start: Date, durationMinutes: number): string {
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const fmt = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${fmt(start)} – ${fmt(end)}`;
}
