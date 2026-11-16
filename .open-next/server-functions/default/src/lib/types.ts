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
  allocated?: number;
  utilized?: number;
  pendingInWallet?: number;
  notes?: string | null;
}

export interface PlatformFee {
  id: string;
  recordType: RecordType;
  recordCode: string;
  month: string;
  baseAmount: number;
  gstRate: number;
  gstAmount: number;
  totalAmount: number;
  isPaid: boolean;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformFeeInput {
  recordType: RecordType;
  recordCode: string;
  month: string;
  baseAmount?: number;
  gstRate?: number;
  isPaid?: boolean;
  paidAt?: string | null;
  notes?: string | null;
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
