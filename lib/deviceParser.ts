export interface DeviceDetails {
  deviceType: "mobile" | "desktop" | "tablet";
  os: string;
  browser: string;
  label: string;
  icon: string;
}

export function parseDevice(
  userAgent?: string | null,
  platformHeader?: string | null,
  mobileHeader?: string | null
): DeviceDetails {
  const ua = (userAgent || "").toLowerCase();
  const platform = (platformHeader || "").toLowerCase();
  const isMobileHeader = mobileHeader === "?1";

  let deviceType: "mobile" | "desktop" | "tablet" = "desktop";
  if (isMobileHeader || /android|iphone|ipod|blackberry|iemobile|opera mini|mobile/i.test(ua)) {
    deviceType = "mobile";
  } else if (/ipad|tablet/i.test(ua)) {
    deviceType = "tablet";
  }

  let os = "Desktop";
  if (/iphone|ipad|ipod/i.test(ua) || platform.includes("ios")) os = "iOS";
  else if (/android/i.test(ua) || platform.includes("android")) os = "Android";
  else if (/macintosh|mac os x/i.test(ua) || platform.includes("mac")) os = "macOS";
  else if (/windows/i.test(ua) || platform.includes("win")) os = "Windows";
  else if (/linux/i.test(ua) || platform.includes("linux")) os = "Linux";

  let browser = "Browser";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/opr\/|opera/i.test(ua)) browser = "Opera";
  else if (/chrome|crios/i.test(ua)) browser = "Chrome";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";

  const icon = deviceType === "mobile" ? "📱" : deviceType === "tablet" ? "📟" : "💻";
  const label = `${os} · ${browser}`;

  return { deviceType, os, browser, label, icon };
}
