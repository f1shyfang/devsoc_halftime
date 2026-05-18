import { Redis } from "@upstash/redis";

declare global {
  // Reuse across Fluid Compute instance warm reuse.
  var __debateconnect_redis: Redis | undefined;
}

export function getRedis(): Redis {
  if (!global.__debateconnect_redis) {
    global.__debateconnect_redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return global.__debateconnect_redis;
}
