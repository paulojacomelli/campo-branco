/** @type {import('next').NextConfig} */
const nextConfig = {
    // output: 'export', // Commented out to allow API Routes (Admin Export) to build. Enable only for APK generation.
    // eslint config removed as it is not supported in next.config.js options
    typescript: {
        ignoreBuildErrors: true,
    },
    images: {
        unoptimized: true, // Required for static export
    },
};

const withPWA = require("@ducanh2912/next-pwa").default({
    dest: "public",
    cacheOnFrontEndNav: true,
    aggressiveFrontEndNavCaching: true,
    reloadOnOnline: true,
    swcMinify: true,
    disable: process.env.NODE_ENV === "development",
    workboxOptions: {
        disableDevLogs: true,
    },
});

// eslint-disable-next-line @next/next/no-assign-module-variable
module.exports = withPWA(nextConfig);
