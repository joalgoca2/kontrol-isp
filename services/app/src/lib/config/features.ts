export interface FeatureFlags {
  pwa: boolean;
  walkthrough: boolean;
  screenLock: boolean;
}

const parseFlag = (val?: string, defaultVal = true): boolean => {
  if (!val) return defaultVal;
  const lower = val.trim().toLowerCase();
  return lower !== "false" && lower !== "0";
};

export const FEATURES: FeatureFlags = {
  pwa: parseFlag(process.env.NEXT_PUBLIC_ENABLE_PWA, true),
  walkthrough: parseFlag(process.env.NEXT_PUBLIC_ENABLE_WALKTHROUGH, true),
  screenLock: parseFlag(process.env.NEXT_PUBLIC_ENABLE_SCREEN_LOCK, true),
};
