import { DeviceDetails, parseDevice } from "./deviceParser";

interface TrackedMetadata {
  userAgent?: string;
  platform?: string;
  mobile?: string;
  ownerKeyHash?: string;
  visitCount: number;
  firstSeenAt: number;
  lastSeenAt: number;
}

// In-memory store for session metadata across server life
const trackerStore = new Map<string, TrackedMetadata>();

export function recordDevicePing(
  voterId: string,
  headers: { userAgent?: string | null; platform?: string | null; mobile?: string | null },
  ownerKeyHash?: string | null
): void {
  const now = Date.now();
  const existing = trackerStore.get(voterId);

  if (existing) {
    existing.lastSeenAt = now;
    existing.visitCount += 1;
    if (headers.userAgent) existing.userAgent = headers.userAgent;
    if (headers.platform) existing.platform = headers.platform;
    if (headers.mobile) existing.mobile = headers.mobile;
    if (ownerKeyHash && !existing.ownerKeyHash) existing.ownerKeyHash = ownerKeyHash;
  } else {
    trackerStore.set(voterId, {
      userAgent: headers.userAgent ?? undefined,
      platform: headers.platform ?? undefined,
      mobile: headers.mobile ?? undefined,
      ownerKeyHash: ownerKeyHash ?? undefined,
      visitCount: 1,
      firstSeenAt: now,
      lastSeenAt: now,
    });
  }
}

export function linkVoterOwnerKey(voterId: string, ownerKeyHash: string): void {
  const existing = trackerStore.get(voterId);
  if (existing) {
    existing.ownerKeyHash = ownerKeyHash;
  } else {
    trackerStore.set(voterId, {
      ownerKeyHash,
      visitCount: 1,
      firstSeenAt: Date.now(),
      lastSeenAt: Date.now(),
    });
  }
}

export function getTrackedMetadata(voterId: string): { details: DeviceDetails; visitCount: number; ownerKeyHash?: string } {
  const existing = trackerStore.get(voterId);
  const details = parseDevice(existing?.userAgent, existing?.platform, existing?.mobile);
  return {
    details,
    visitCount: existing?.visitCount ?? 1,
    ownerKeyHash: existing?.ownerKeyHash,
  };
}
