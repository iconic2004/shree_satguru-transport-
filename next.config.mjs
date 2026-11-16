/**
 * Build/dev-time guard for Supabase key configuration. Runs after Next.js has
 * loaded .env* files. Messages contain variable NAMES only — never values.
 */
function jwtRole(value) {
  const parts = String(value).split('.')
  if (parts.length !== 3) return null
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')).role ?? null
  } catch {
    return null
  }
}

/** @param {Record<string, string | undefined>} [env] */
export function checkSupabaseEnv(env = process.env) {
  const errors = []

  // Anything NEXT_PUBLIC_* is embedded in browser bundles.
  for (const name of Object.keys(env)) {
    if (/^NEXT_PUBLIC_SUPABASE_.*(SECRET|SERVICE_ROLE)/.test(name)) {
      errors.push(`${name}: a secret key must never use the NEXT_PUBLIC_ prefix (it would be shipped to browsers). Use SUPABASE_SECRET_KEY.`)
    }
  }

  const publishable = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (publishable && (publishable.startsWith('sb_secret_') || jwtRole(publishable) === 'service_role')) {
    errors.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY contains a SECRET key. Put the sb_publishable_… key there instead.')
  }

  const secret = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
  if (secret && (secret.startsWith('sb_publishable_') || jwtRole(secret) === 'anon')) {
    errors.push('SUPABASE_SECRET_KEY contains a publishable key. Put the sb_secret_… key there instead.')
  }

  if (errors.length) {
    throw new Error(`Invalid Supabase environment configuration:\n - ${errors.join('\n - ')}`)
  }

  const legacy = [
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'],
    ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'],
  ].filter(([oldName, newName]) => env[oldName] && !env[newName])
  if (legacy.length) {
    console.warn(
      `[supabase] Using legacy env var name(s): ${legacy.map(([o, n]) => `${o} (rename to ${n})`).join(', ')}`
    )
  }
}

checkSupabaseEnv()

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optional separate output folder (e.g. for a verification build while `next dev`
  // is using .next). Defaults to the standard .next.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  poweredByHeader: false,
  webpack: (config) => {
    config.cache = false;
    return config;
  },
  images: {
    // Only optimise images served from Supabase Storage (was: any HTTPS host,
    // which turned /_next/image into an open image proxy).
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
