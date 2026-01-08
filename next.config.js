/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export',
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

module.exports = withPWA(nextConfig);
