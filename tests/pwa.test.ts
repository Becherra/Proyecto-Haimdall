import { describe, expect, it } from "vitest";
import { getInstallMode, isIosDevice } from "../src/lib/pwa";
import manifest from "../src/app/manifest";

const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1";
const IPAD_AS_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";

describe("getInstallMode", () => {
  it("reports installed when running standalone, even with a pending prompt", () => {
    expect(getInstallMode({ isStandalone: true, hasPromptEvent: true, userAgent: ANDROID_CHROME })).toBe("installed");
  });
  it("offers the native prompt when the browser provided the event", () => {
    expect(getInstallMode({ isStandalone: false, hasPromptEvent: true, userAgent: ANDROID_CHROME })).toBe("prompt");
  });
  it("shows manual steps on iPhone Safari", () => {
    expect(getInstallMode({ isStandalone: false, hasPromptEvent: false, userAgent: IPHONE_SAFARI })).toBe("ios-manual");
  });
  it("shows nothing on iOS browsers that are not Safari", () => {
    expect(getInstallMode({ isStandalone: false, hasPromptEvent: false, userAgent: IPHONE_CHROME })).toBe("unavailable");
  });
  it("shows nothing on desktop without a prompt event", () => {
    expect(getInstallMode({ isStandalone: false, hasPromptEvent: false, userAgent: ANDROID_CHROME })).toBe("unavailable");
  });
});

describe("isIosDevice", () => {
  it("detects iPadOS that reports itself as a Mac by its touch points", () => {
    expect(isIosDevice(IPAD_AS_MAC, 5)).toBe(true);
    expect(isIosDevice(IPAD_AS_MAC, 0)).toBe(false);
  });
});

describe("web app manifest", () => {
  const m = manifest();
  it("is installable: standalone display, start url and 192/512 icons", () => {
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/");
    const sizes = (m.icons ?? []).map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });
  it("includes a maskable icon", () => {
    expect((m.icons ?? []).some((i) => i.purpose === "maskable")).toBe(true);
  });
});
