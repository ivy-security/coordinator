import { generateSlotStarts } from "./time-slots";

interface Range {
  id: string;
  startTime: string | Date;
  endTime: string | Date;
}

interface AvailabilityRecord {
  userId: string;
  rangeId: string;
  slots: (string | Date)[];
}

export interface SlotOverlap {
  rangeId: string;
  start: Date;
  end: Date;
  availableCount: number;
  totalRequired: number;
  availableUserIds: string[];
}

/**
 * Compute overlap: for each possible slot in each range, count how many
 * of the required participants are available for that slot.
 */
export function computeOverlap(
  duration: number,
  ranges: Range[],
  availabilities: AvailabilityRecord[],
  requiredUserIds: string[]
): SlotOverlap[] {
  const results: SlotOverlap[] = [];

  for (const range of ranges) {
    const rangeStart = new Date(range.startTime);
    const rangeEnd = new Date(range.endTime);
    const slotStarts = generateSlotStarts(rangeStart, rangeEnd, duration);

    // Get all availabilities for this range
    const rangeAvails = availabilities.filter((a) => a.rangeId === range.id);

    // Build a map: userId -> Set of slot start times (as ISO strings)
    const userSlotMap = new Map<string, Set<string>>();
    for (const avail of rangeAvails) {
      const slotSet = new Set(
        avail.slots.map((s) => new Date(s).toISOString())
      );
      userSlotMap.set(avail.userId, slotSet);
    }

    for (const slotStart of slotStarts) {
      const slotIso = slotStart.toISOString();
      const availableUserIds: string[] = [];

      for (const userId of requiredUserIds) {
        const userSlots = userSlotMap.get(userId);
        if (userSlots?.has(slotIso)) {
          availableUserIds.push(userId);
        }
      }

      results.push({
        rangeId: range.id,
        start: slotStart,
        end: new Date(slotStart.getTime() + duration * 60 * 1000),
        availableCount: availableUserIds.length,
        totalRequired: requiredUserIds.length,
        availableUserIds,
      });
    }
  }

  // Sort: fully available first, then by count descending
  results.sort((a, b) => b.availableCount - a.availableCount);

  return results;
}
