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
 * Get the previous month (YYYY-MM) for a given month.
 * e.g. previousMonth("2025-03") -> "2025-02"
 *      previousMonth("2025-01") -> "2024-12"
 */
export function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 2, 1) // m-2 because JS months are 0-indexed and we want prev
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Get the next month (YYYY-MM) for a given month.
 * e.g. nextMonth("2025-01") -> "2025-02"
 *      nextMonth("2025-12") -> "2026-01"
 */
export function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m, 1) // m (not m-1) gives next month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Get the day of the month (1-31) for the current date.
 */
export function currentDayOfMonth(): number {
  return new Date().getDate()
}

/**
 * Check if today is on or after the 25th of the month
 * (the media budget renewal reminder trigger day).
 */
export function isRenewalReminderDay(): boolean {
  return currentDayOfMonth() >= 25
}

/**
 * Calculate the pending-in-wallet balance for a media spend entry.
 *
 * Formula: pendingInWallet = allocated (this month) + previousPending - utilized
 *
 * - "allocated" = this month's budget added to the wallet
 * - "previousPending" = last month's carried-over wallet balance (0 if none)
 * - "utilized" = this month's spend
 *
 * @param allocated This month's allocated budget
 * @param utilized This month's utilized amount
 * @param previousPending Previous month's pendingInWallet (0 if no prior entry)
 */
export function calculatePendingInWallet(
  allocated: number,
  utilized: number,
  previousPending: number
): number {
  return +(allocated + previousPending - utilized).toFixed(2)
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
