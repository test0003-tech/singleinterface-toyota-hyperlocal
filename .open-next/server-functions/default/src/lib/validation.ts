// Validation helpers for landing numbers and other fields

/**
 * Validate a comma-separated list of 10-digit mobile numbers.
 * Rules:
 *   - Optional (empty/null is valid)
 *   - Each entry must be exactly 10 digits
 *   - Maximum 5 numbers
 * Returns null if valid, or an error message string.
 */
export function validateLandingNumbers(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parts = trimmed
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '')
  if (parts.length === 0) return null
  if (parts.length > 5) {
    return `Maximum 5 numbers allowed (you entered ${parts.length})`
  }
  for (const p of parts) {
    if (!/^\d{10}$/.test(p)) {
      return `Each number must be exactly 10 digits. Invalid: "${p}"`
    }
  }
  return null
}

/**
 * Normalize landing numbers string: trim, remove empty parts, single comma separator.
 */
export function normalizeLandingNumbers(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parts = trimmed
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '')
  if (parts.length === 0) return null
  return parts.join(',')
}

/**
 * Count the number of landing numbers in a comma-separated string.
 */
export function countLandingNumbers(value: string | null | undefined): number {
  if (!value) return 0
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '').length
}

/**
 * Get current month string in YYYY-MM format (Asia/Shanghai timezone).
 */
export function currentMonth(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/**
 * Format a month string (YYYY-MM) into a readable label (e.g. "Jan 2025").
 */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-')
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ]
  const idx = Number(m) - 1
  if (idx < 0 || idx > 11) return month
  return `${monthNames[idx]} ${y}`
}

/**
 * Get a list of recent months (YYYY-MM) ending at current month.
 */
export function recentMonths(count: number = 12): string[] {
  const result: string[] = []
  const now = new Date()
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    )
  }
  return result
}

/**
 * Format currency value (INR) for display.
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value)
}
