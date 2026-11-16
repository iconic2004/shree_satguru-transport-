'use client'

// Last-resort boundary for errors in the root layout itself.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '4rem 1rem', textAlign: 'center', background: '#f8fafc' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f294a' }}>Something went wrong</h2>
        <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0.5rem 0 1.5rem' }}>
          The application failed to load. Please try again.
        </p>
        <button
          onClick={reset}
          style={{ background: '#0f294a', color: '#fff', border: 0, borderRadius: 6, padding: '0.5rem 1rem', cursor: 'pointer' }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
