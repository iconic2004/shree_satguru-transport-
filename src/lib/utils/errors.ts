interface ErrorLike {
  message?: unknown
  code?: unknown
  details?: unknown
}

/**
 * Turn a Supabase/PostgREST/Postgres error (or anything thrown) into a message
 * that is safe and useful to show to an end user.
 */
export function getErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!err) return fallback
  if (typeof err === 'string') return err

  const e = err as ErrorLike
  const code = typeof e.code === 'string' ? e.code : undefined
  const message = typeof e.message === 'string' ? e.message : undefined

  switch (code) {
    case '23505':
      return 'A record with these details already exists (duplicate number or name).'
    case '23503':
      return 'This record references data that does not exist or is still in use.'
    case '23502':
      return 'A required field is missing.'
    case '23514':
      return message && !message.startsWith('new row') ? message : 'One of the values is outside the allowed range.'
    case '22P02':
      return 'One of the values has an invalid format.'
    case '42501':
    case 'PGRST301':
      return 'You do not have permission to perform this action.'
    case 'PGRST116':
      return 'The requested record was not found.'
  }

  if (message) {
    if (/row-level security/i.test(message)) return 'You do not have permission to perform this action.'
    if (/failed to fetch|fetch failed|network/i.test(message)) {
      return 'Unable to reach the server. Check your internet connection and try again.'
    }
    return message
  }
  return fallback
}
