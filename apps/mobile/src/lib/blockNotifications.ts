import * as Notifications from "expo-notifications";
import { DailyInstance, BehavioralInsight, BlockTask } from "../types/database";
import { minutesToTime as formatTime } from "./time";
import { preemptBody, preemptTitle, resolvePreempt, PreemptCandidate } from "./preempt";
import { groupBlockTasks } from "./blockTasks";
import { cutoffNudgeLine } from "./cutoffNudge";
import { cutoffTitle } from "./cutoffTitle";

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

// Cancels the ENTIRE managed set, then scheduleTodayBlockNotifications
// rebuilds it from its arguments. Any caller that omits an optional
// argument therefore DELETES that category rather than leaving it alone.
// Every call site must pass the full set.
const MANAGED_TYPES = [
  "block_complete",
  "block_cutoff",
  "block_followup",
  "block_preempt",
];

// Scheduled cancel does not clear a banner that already fired. Completing
// a block after "How'd it go?" has landed left the stale prompt sitting
// in Notification Center. Dismiss anything whose instance is no longer
// open, and a preempt that fired at a start the instance no longer has.
async function dismissResolvedBanners(
  instances: DailyInstance[],
  resolvedPreempt: PreemptCandidate | null,
  nowMinutes: number
): Promise<void> {
  const openIds = new Set(
    instances
      .filter((i) => i.status === "pending" || i.status === "active")
      .map((i) => i.id)
  );
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      presented
        .filter((n) => {
          const type = n.request.content.data?.type as string | undefined;
          const id = n.request.content.data?.instanceId as string | undefined;
          if (!type || !MANAGED_TYPES.includes(type) || !id) return false;
          if (type === "block_preempt") {
            if (!resolvedPreempt || id !== resolvedPreempt.instanceId) {
              return true;
            }
            // Still going to fire later — this banner went off at the old slot.
            return resolvedPreempt.startMinutes > nowMinutes + 1;
          }
          return !openIds.has(id);
        })
        .map((n) => Notifications.dismissNotificationAsync(n.request.identifier))
    );
  } catch {
    // Presented-notification APIs are missing in some Expo Go builds.
  }
}

export async function cancelTodayBlockNotifications(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const todayBlockNotifs = scheduled.filter((n) =>
    MANAGED_TYPES.includes(n.content.data?.type as string)
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
  insights: BehavioralInsight[] = [],
  preempt: PreemptCandidate | null = null,
  tasks: BlockTask[] = []
): Promise<ScheduledCutoff[]> {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const livePreempt = resolvePreempt(preempt, instances, nowMinutes);

  // Cancel existing ones first to avoid duplicates on refresh
  await cancelTodayBlockNotifications();
  await dismissResolvedBanners(instances, livePreempt, nowMinutes);

  const scheduledCutoffs: ScheduledCutoff[] = [];
  const [year, month, day] = date.split("-").map(Number);
  const tasksByBlockId = groupBlockTasks(tasks);

  // Only schedule blocks that haven't ended yet.
  // A wind_down block's goal is ending screen time, so a phone notification at
  // its end is self-defeating. Captured retroactively instead.
  const futureInstances = instances.filter(
    (inst) =>
      inst.end_minutes > nowMinutes + 1 &&
      inst.block?.category !== "wind_down" &&
      (inst.status === "pending" || inst.status === "active")
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
    const title = cutoffTitle(tasksByBlockId[inst.block_id] ?? []);
    const hasIntent = title != null;
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

        // Cost of THIS block running over. An insight that only names the
        // next block (a morning→afternoon keystone on a Cardio cutoff) is
        // a different relationship and reads as noise.
        const endLabel = formatTime(inst.end_minutes);
        const nudgeLine = cutoffNudgeLine(
          insights,
          inst.block.name,
          next?.block?.name
        );
        const body = nudgeLine
          ? `Ends at ${endLabel}. ${nudgeLine}`
          : next?.block?.name
          ? `Ends at ${endLabel}. ${next.block.name} is next.`
          : `Ends at ${endLabel}.`;

        await Notifications.scheduleNotificationAsync({
          content: {
            title,
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

  if (livePreempt) {
    const startDate = new Date(
      year,
      month - 1,
      day,
      Math.floor(livePreempt.startMinutes / 60),
      livePreempt.startMinutes % 60,
      0
    );

    if (startDate > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: preemptTitle(livePreempt),
          body: preemptBody(livePreempt),
          sound: true,
          data: {
            type: "block_preempt",
            instanceId: livePreempt.instanceId,
            screen: "today",
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: startDate,
        },
      });
    }
  }

  return scheduledCutoffs;
}
