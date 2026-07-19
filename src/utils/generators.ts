/**
 * Generate a unique claim number.
 * Format: CLM-{base36 timestamp}-{random 4 chars}
 */
export function generateClaimNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CLM-${ts}-${rand}`;
}

/**
 * Generate a unique policy number.
 * Format: POL-{base36 timestamp}-{random 4 chars}
 */
export function generatePolicyNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `POL-${ts}-${rand}`;
}
