import * as Notifications from "expo-notifications";
import { DailyInstance, BehavioralInsight } from "../types/database";
import { minutesToTime as formatTime } from "./time";

export interface ScheduledCutoff {
  instanceId: string;
  scheduledFor: Date;
}

export const CUTOFF_CATEGORY = "block_cutoff_actions";

export async function registerNotificationCategories(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(CUTOFF_CATEGORY, [
    {
      identifier: "wrapping_up",
      buttonTitle: "Wrapping up",
      options: { opensAppToForeground: false },
    },
    {
      identifier: "more_time",
      buttonTitle: "Need 15 more",
      options: { opensAppToForeground: false },
    },
  ]);
}

export async function scheduleFollowUpNudge(
  instanceId: string,
  taskTitle: string
): Promise<void> {
  const when = new Date(Date.now() + 15 * 60 * 1000);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: taskTitle,
      body: "That's the 15.",
      sound: false,
      data: { type: "block_followup", instanceId, screen: "today" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: when,
    },
  });
}

// Cancel all previously scheduled block notifications for today
// Call this before rescheduling to avoid duplicates
export async function cancelTodayBlockNotifications(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const managed = ["block_complete", "block_cutoff", "block_followup"];
  const todayBlockNotifs = scheduled.filter((n) =>
    managed.includes(n.content.data?.type as string)
  );
  await Promise.all(
    todayBlockNotifs.map((n) =>
      Notifications.cancelScheduledNotificationAsync(n.identifier)
    )
  );
}

export async function scheduleTodayBlockNotifications(
  instances: DailyInstance[],
  date: string,
  insights: BehavioralInsight[] = []
): Promise<ScheduledCutoff[]> {
  // Cancel existing ones first to avoid duplicates on refresh
  await cancelTodayBlockNotifications();

  const scheduledCutoffs: ScheduledCutoff[] = [];
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const [year, month, day] = date.split("-").map(Number);

  // Only schedule blocks that haven't ended yet.
  // A wind_down block's goal is ending screen time, so a phone notification at
  // its end is self-defeating. Captured retroactively instead.
  const futureInstances = instances.filter(
    (inst) =>
      inst.end_minutes > nowMinutes + 1 &&
      inst.block?.category !== "wind_down"
  );

  for (const inst of futureInstances) {
    if (!inst.block?.name) continue;

    const endHour = Math.floor(inst.end_minutes / 60);
    const endMinute = inst.end_minutes % 60;

    const triggerDate = new Date(year, month - 1, day, endHour, endMinute, 0);

    // Skip if trigger is in the past (safety check)
    if (triggerDate <= now) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${inst.block.name} — time's up`,
        body: "How'd it go?",
        sound: true,
        data: {
          type: "block_complete",
          instanceId: inst.id,
          screen: "today",
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });

    // Cutoff nudge: 10 min before end, only when the user stated an intention
    // and the block is long enough that a 10-min warning is meaningful.
    const duration = inst.end_minutes - inst.start_minutes;
    const hasIntent = !!inst.task_detail && inst.task_detail.trim().length > 0;
    const isOpen = inst.status === "pending" || inst.status === "active";

    if (hasIntent && isOpen && duration >= 30) {
      // Later of midpoint or end-30. Short blocks need enough runway to still
      // act on the nudge; long blocks need the warning near the end, where
      // overrun happens. A fixed offset cannot serve both.
      const midpoint = inst.start_minutes + Math.floor(duration / 2);
      const cutoffMinutes = Math.max(midpoint, inst.end_minutes - 30);
      const cutoffDate = new Date(
        year,
        month - 1,
        day,
        Math.floor(cutoffMinutes / 60),
        cutoffMinutes % 60,
        0
      );

      if (cutoffDate > now) {
        // Name what's next — the downstream cost is the point of the nudge.
        const next = instances
          .filter((i) => i.start_minutes >= inst.end_minutes && i.id !== inst.id)
          .sort((a, b) => a.start_minutes - b.start_minutes)[0];

        // Prefer an insight about the NEXT block — that is what running over costs.
        // Fall back to one about the current block. Strengths are excluded; a
        // strength in a cutoff warning reads as sarcasm.
        const usable = insights.filter(
          (i) => i.kind !== "strength" && !!i.nudge_line
        );
        const relevant =
          (next?.block?.name &&
            usable.find((i) => i.related_blocks.includes(next.block!.name))) ||
          usable.find((i) => i.related_blocks.includes(inst.block!.name)) ||
          null;

        const endLabel = formatTime(inst.end_minutes);
        const body = relevant?.nudge_line
          ? `Ends at ${endLabel}. ${relevant.nudge_line}`
          : next?.block?.name
          ? `Ends at ${endLabel}. ${next.block.name} is next.`
          : `Ends at ${endLabel}.`;

        await Notifications.scheduleNotificationAsync({
          content: {
            title: inst.task_detail!.trim().slice(0, 60),
            body,
            sound: false,
            categoryIdentifier: CUTOFF_CATEGORY,
            data: {
              type: "block_cutoff",
              instanceId: inst.id,
              screen: "today",
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: cutoffDate,
          },
        });

        scheduledCutoffs.push({ instanceId: inst.id, scheduledFor: cutoffDate });
      }
    }
  }

  return scheduledCutoffs;
}
