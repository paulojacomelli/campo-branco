const pkg = require('./package.json');

/** @type {import('next').NextConfig} */
const isGithubActions = process.env.GITHUB_ACTIONS === 'true';

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: isGithubActions ? 'export' : undefined,
    trailingSlash: true, // Adicionado para compatibilidade com GitHub Pages
    // Se o seu domínio for campobranco.github.io/campobranco, descomente a linha abaixo:
    // basePath: isGithubActions ? '/campobranco' : '',
    typescript: {
        ignoreBuildErrors: true,
    },
    images: {
        unoptimized: true,
    },
    env: {
        NEXT_PUBLIC_APP_VERSION: pkg.version,
        // Define a URL base para as APIs. No GitHub, aponta para o Firebase.
        NEXT_PUBLIC_API_BASE_URL: isGithubActions ? 'https://campo-branco.web.app' : '',
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
