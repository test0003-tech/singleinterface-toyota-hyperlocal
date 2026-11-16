// Shared types for SI and Spotlight records

export interface SIRecord {
  id: string;
  siCode: string;
  clientCode: string;
  businessProfileId: string | null;
  businessName: string | null;
  alternativeName: string | null;
  circle: string | null;
  address1: string | null;
  address2: string | null;
  locality: string | null;
  landmark: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  latitude: string | null;
  longitude: string | null;
  googlePlusPage: string | null;
  vmnSi: string | null;
  weeklyOff: string | null;
  businessHours: string | null;
  website: string | null;
  placeId: string | null;
  locationGroup: string | null;
  gmbListingStatus: string | null;
  isLive: boolean;
  liveSince: string | null;
  salesLandingNumbers: string | null;
  serviceLandingNumbers: string | null;
  linkedSpotlightCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SpotlightRecord {
  id: string;
  clientCode: string;
  name: string | null;
  alternateName: string | null;
  internalCode: string | null;
  region: string | null;
  state: string | null;
  city: string | null;
  country: string | null;
  pincode: string | null;
  locality: string | null;
  addressLine1: string | null;
  latitude: string | null;
  longitude: string | null;
  vmn: string | null;
  domain: string | null;
  adAccountCid: string | null;
  facebookPageId: string | null;
  isLive: boolean;
  liveSince: string | null;
  spotlightLandingNumbers: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SIRecordInput {
  siCode: string;
  clientCode: string;
  businessProfileId?: string | null;
  businessName?: string | null;
  alternativeName?: string | null;
  circle?: string | null;
  address1?: string | null;
  address2?: string | null;
  locality?: string | null;
  landmark?: string | null;
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  googlePlusPage?: string | null;
  vmnSi?: string | null;
  weeklyOff?: string | null;
  businessHours?: string | null;
  website?: string | null;
  placeId?: string | null;
  locationGroup?: string | null;
  gmbListingStatus?: string | null;
  isLive?: boolean;
  liveSince?: string | null;
  salesLandingNumbers?: string | null;
  serviceLandingNumbers?: string | null;
  linkedSpotlightCode?: string | null;
}

export interface SpotlightRecordInput {
  clientCode: string;
  name?: string | null;
  alternateName?: string | null;
  internalCode?: string | null;
  region?: string | null;
  state?: string | null;
  city?: string | null;
  country?: string | null;
  pincode?: string | null;
  locality?: string | null;
  addressLine1?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  vmn?: string | null;
  domain?: string | null;
  adAccountCid?: string | null;
  facebookPageId?: string | null;
  isLive?: boolean;
  liveSince?: string | null;
  spotlightLandingNumbers?: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DashboardStats {
  si: {
    total: number;
    live: number;
    byState: { state: string; count: number }[];
    byCircle: { circle: string; count: number }[];
    byGmbStatus: { status: string; count: number }[];
  };
  spotlight: {
    total: number;
    live: number;
    byState: { state: string; count: number }[];
    byRegion: { region: string; count: number }[];
    byCountry: { country: string; count: number }[];
  };
  mediaSpend: {
    totalAllocated: number;
    totalUtilized: number;
    totalPending: number;
    // Meta breakdown
    metaAllocated: number;
    metaUtilized: number;
    metaPending: number;
    // Google breakdown
    googleAllocated: number;
    googleUtilized: number;
    googlePending: number;
    byMonth: { month: string; allocated: number; utilized: number; pending: number }[];
  };
  platformFees: {
    totalBilled: number;
    totalPaid: number;
    totalPending: number;
    paidCount: number;
    pendingCount: number;
    byMonth: { month: string; billed: number; paid: number }[];
  };
}

export type RecordType = 'SI' | 'Spotlight';

export interface MediaSpend {
  id: string;
  recordType: RecordType;
  recordCode: string;
  month: string;
  // Meta
  metaAllocated: number;
  metaUtilized: number;
  metaPendingInWallet: number;
  // Google
  googleAllocated: number;
  googleUtilized: number;
  googlePendingInWallet: number;
  // Totals (auto-computed)
  allocated: number;
  utilized: number;
  pendingInWallet: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MediaSpendInput {
  recordType: RecordType;
  recordCode: string;
  month: string;
  metaAllocated?: number;
  metaUtilized?: number;
  googleAllocated?: number;
  googleUtilized?: number;
  notes?: string | null;
}

export interface PlatformFee {
  id: string;
  recordType: RecordType;
  recordCode: string;
  month: string;
  invoiceNumber: string | null;
  baseAmount: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
  lateFee: number;
  amountPaid: number;
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  dueDate: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformFeeInput {
  recordType: RecordType;
  recordCode: string;
  month: string;
  invoiceNumber?: string | null;
  baseAmount?: number;
  gstRate?: number;
  lateFee?: number;
  dueDate?: string | null;
  notes?: string | null;
}

export type PaymentMethod = 'bank_transfer' | 'cheque' | 'upi' | 'cash' | 'card' | 'other';

export interface Payment {
  id: string;
  platformFeeId: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  paidDate: string;
  notes: string | null;
  createdAt: string;
}

export interface PaymentInput {
  platformFeeId: string;
  amount: number;
  method?: PaymentMethod;
  reference?: string | null;
  paidDate?: string | null;
  notes?: string | null;
}

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

export interface PlatformFeeWithPayments extends PlatformFee {
  payments: Payment[];
}

export interface FinanceSummary {
  mediaSpend: {
    totalAllocated: number;
    totalUtilized: number;
    totalPending: number;
    byMonth: { month: string; allocated: number; utilized: number; pending: number }[];
  };
  platformFees: {
    totalBilled: number;
    totalPaid: number;
    totalPending: number;
    paidCount: number;
    pendingCount: number;
    byMonth: { month: string; billed: number; paid: number }[];
  };
}

export interface ReminderAlert {
  severity: 'critical' | 'warning' | 'info';
  category:
    | 'missing_platform_fee'
    | 'missing_media_spend'
    | 'pending_payment'
    | 'media_deficit'
    | 'live_campaign'
    | 'media_renewal'
    | 'custom_rule'
    | 'campaign_blocked';
  title: string;
  message: string;
  count?: number;
  amount?: number;
  locations?: { code: string; type: string; name?: string | null }[];
}

export interface RemindersData {
  month: string;
  liveCampaigns: {
    si: { total: number; live: number };
    spotlight: { total: number; live: number };
  };
  platformFees: {
    required: number;
    present: number;
    missing: number;
    totalBilled: number;
    totalPaid: number;
    totalPending: number;
    pendingCount: number;
    missingLocations: { code: string; type: string; name?: string | null }[];
    pendingLocations: { code: string; type: string; amount: number; name?: string | null }[];
  };
  mediaSpend: {
    liveLocations: number;
    withEntry: number;
    withoutEntry: number;
    totalAllocated: number;
    totalUtilized: number;
    totalPendingWallet: number;
    deficitCount: number;
    missingLocations: { code: string; type: string; name?: string | null }[];
    deficitLocations: {
      code: string;
      type: string;
      allocated: number;
      utilized: number;
      deficit: number;
      name?: string | null;
    }[];
  };
  mediaRenewal: {
    isReminderDay: boolean;
    dayOfMonth: number;
    nextMonth: string;
    liveLocationsNeedingRenewal: number;
    locationsNeedingRenewal: { code: string; type: string; name?: string | null }[];
  };
  alerts: ReminderAlert[];
}

export interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

// --- Custom Alert Rules ---
export type RuleTargetType = 'SI' | 'Spotlight' | 'MediaSpend' | 'PlatformFee';

export type RuleOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_or_equal'
  | 'less_or_equal'
  | 'contains'
  | 'not_contains'
  | 'is_empty'
  | 'is_not_empty'
  | 'days_overdue';

export type RuleSeverity = 'info' | 'warning' | 'critical';

export interface Rule {
  id: string;
  name: string;
  description: string | null;
  targetType: RuleTargetType;
  field: string;
  operator: RuleOperator;
  value: string | null;
  severity: RuleSeverity;
  scopeMonth: boolean;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RuleInput {
  name: string;
  description?: string | null;
  targetType: RuleTargetType;
  field: string;
  operator: RuleOperator;
  value?: string | null;
  severity?: RuleSeverity;
  scopeMonth?: boolean;
  isEnabled?: boolean;
}

// Field metadata for the rule builder UI
export interface RuleFieldDef {
  field: string;
  label: string;
  type: 'number' | 'string' | 'boolean' | 'computed';
  applicableTo: RuleTargetType[];
  description?: string;
}

export const RULE_FIELDS: RuleFieldDef[] = [
  // SI fields
  { field: 'isLive', label: 'Is Live', type: 'boolean', applicableTo: ['SI', 'Spotlight'] },
  { field: 'gmbListingStatus', label: 'GMB Listing Status', type: 'string', applicableTo: ['SI'] },
  { field: 'salesLandingNumbers', label: 'Sales Landing Numbers', type: 'string', applicableTo: ['SI'] },
  { field: 'serviceLandingNumbers', label: 'Service Landing Numbers', type: 'string', applicableTo: ['SI'] },
  { field: 'spotlightLandingNumbers', label: 'Spotlight Landing Numbers', type: 'string', applicableTo: ['Spotlight'] },
  { field: 'circle', label: 'Circle', type: 'string', applicableTo: ['SI'] },
  { field: 'region', label: 'Region', type: 'string', applicableTo: ['Spotlight'] },
  // MediaSpend fields
  { field: 'allocated', label: 'Total Allocated Budget', type: 'number', applicableTo: ['MediaSpend'] },
  { field: 'utilized', label: 'Total Utilized Amount', type: 'number', applicableTo: ['MediaSpend'] },
  { field: 'pendingInWallet', label: 'Total Pending in Wallet', type: 'number', applicableTo: ['MediaSpend'] },
  { field: 'utilizationPercent', label: 'Total Utilization %', type: 'computed', applicableTo: ['MediaSpend'], description: 'total utilized / total allocated * 100' },
  // Meta fields
  { field: 'metaAllocated', label: 'Meta Allocated', type: 'number', applicableTo: ['MediaSpend'] },
  { field: 'metaUtilized', label: 'Meta Utilized', type: 'number', applicableTo: ['MediaSpend'] },
  { field: 'metaPendingInWallet', label: 'Meta Pending in Wallet', type: 'number', applicableTo: ['MediaSpend'] },
  { field: 'metaUtilizationPercent', label: 'Meta Utilization %', type: 'computed', applicableTo: ['MediaSpend'], description: 'meta utilized / meta allocated * 100' },
  // Google fields
  { field: 'googleAllocated', label: 'Google Allocated', type: 'number', applicableTo: ['MediaSpend'] },
  { field: 'googleUtilized', label: 'Google Utilized', type: 'number', applicableTo: ['MediaSpend'] },
  { field: 'googlePendingInWallet', label: 'Google Pending in Wallet', type: 'number', applicableTo: ['MediaSpend'] },
  { field: 'googleUtilizationPercent', label: 'Google Utilization %', type: 'computed', applicableTo: ['MediaSpend'], description: 'google utilized / google allocated * 100' },
  // PlatformFee fields
  { field: 'totalAmount', label: 'Total Amount', type: 'number', applicableTo: ['PlatformFee'] },
  { field: 'isPaid', label: 'Is Paid', type: 'boolean', applicableTo: ['PlatformFee'] },
  { field: 'baseAmount', label: 'Base Amount', type: 'number', applicableTo: ['PlatformFee'] },
];

export const RULE_OPERATORS: { value: RuleOperator; label: string; needsValue: boolean }[] = [
  { value: 'equals', label: 'equals', needsValue: true },
  { value: 'not_equals', label: 'does not equal', needsValue: true },
  { value: 'greater_than', label: 'is greater than', needsValue: true },
  { value: 'less_than', label: 'is less than', needsValue: true },
  { value: 'greater_or_equal', label: 'is greater than or equal', needsValue: true },
  { value: 'less_or_equal', label: 'is less than or equal', needsValue: true },
  { value: 'contains', label: 'contains', needsValue: true },
  { value: 'not_contains', label: 'does not contain', needsValue: true },
  { value: 'is_empty', label: 'is empty', needsValue: false },
  { value: 'is_not_empty', label: 'is not empty', needsValue: false },
  { value: 'days_overdue', label: 'days overdue (over)', needsValue: true },
];

export interface RuleEvaluationResult {
  rule: Rule;
  matchedCount: number;
  matchedItems: { code: string; type: string; name?: string | null; detail?: string }[];
}
