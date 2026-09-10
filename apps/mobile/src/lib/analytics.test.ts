import { describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { getItem: vi.fn(), setItem: vi.fn() },
}));
vi.mock("expo-constants", () => ({
  default: { expoConfig: { extra: {} } },
}));

import {
  notificationTypeFromData,
  normalizePermissionStatus,
  reflectionLengthBucket,
} from "./analytics";

describe("reflectionLengthBucket", () => {
  it("buckets by character count, never the text", () => {
    expect(reflectionLengthBucket(0)).toBe("short");
    expect(reflectionLengthBucket(39)).toBe("short");
    expect(reflectionLengthBucket(40)).toBe("medium");
    expect(reflectionLengthBucket(119)).toBe("medium");
    expect(reflectionLengthBucket(120)).toBe("long");
  });
});

describe("normalizePermissionStatus", () => {
  it("keeps the three statuses the funnel uses", () => {
    expect(normalizePermissionStatus("granted")).toBe("granted");
    expect(normalizePermissionStatus("denied")).toBe("denied");
    expect(normalizePermissionStatus("undetermined")).toBe("undetermined");
  });

  it("maps iOS provisional grants rather than inventing a fourth status", () => {
    expect(normalizePermissionStatus("provisional")).toBe("granted");
    expect(normalizePermissionStatus("something-else")).toBe("undetermined");
  });
});

describe("notificationTypeFromData", () => {
  it("maps payload types to the funnel names", () => {
    expect(notificationTypeFromData("block_preempt")).toBe("preempt");
    expect(notificationTypeFromData("block_complete")).toBe("block_complete");
    expect(notificationTypeFromData("block_cutoff")).toBe("cutoff");
    expect(notificationTypeFromData("nightly_fill")).toBe("nightly");
    expect(notificationTypeFromData("unknown")).toBeNull();
  });
});
