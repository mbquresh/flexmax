import * as Notifications from "expo-notifications";
import { DailyInstance } from "../types/database";

// Cancel all previously scheduled block notifications for today
// Call this before rescheduling to avoid duplicates
export async function cancelTodayBlockNotifications(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const todayBlockNotifs = scheduled.filter(
    (n) => n.content.data?.type === "block_complete"
  );
  await Promise.all(
    todayBlockNotifs.map((n) =>
      Notifications.cancelScheduledNotificationAsync(n.identifier)
    )
  );
}

export async function scheduleTodayBlockNotifications(
  instances: DailyInstance[],
  date: string
): Promise<void> {
  // Cancel existing ones first to avoid duplicates on refresh
  await cancelTodayBlockNotifications();

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Only schedule blocks that haven't ended yet
  const futureInstances = instances.filter(
    (inst) => inst.end_minutes > nowMinutes + 1 // at least 1 min in the future
  );

  for (const inst of futureInstances) {
    if (!inst.block?.name) continue;

    // Compute the exact local Date when this block ends
    const [year, month, day] = date.split("-").map(Number);
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
  }
}
