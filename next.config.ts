import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    PUSHER_APP_ID: process.env.PUSHER_APP_ID || '',
    PUSHER_KEY: process.env.PUSHER_KEY || '',
    PUSHER_SECRET: process.env.PUSHER_SECRET || '',
    PUSHER_CLUSTER: process.env.PUSHER_CLUSTER || 'us2',
  }
};

export default nextConfig;
