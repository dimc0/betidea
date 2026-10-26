import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Lit UPSTASH_REDIS_REST_URL et UPSTASH_REDIS_REST_TOKEN
export const redis = Redis.fromEnv();

export const QUOTA_ANALYSES = 5;

export const limiteurAnalyses = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(QUOTA_ANALYSES, "1 h"),
  prefix: "betidea:analyses",
});
