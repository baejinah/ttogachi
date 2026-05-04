import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Allow Firebase Auth popups (signInWithPopup / reauthenticateWithPopup)
        // to communicate back to the opener via postMessage. Without this,
        // the default same-origin policy breaks Google OAuth + Calendar reauth.
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
