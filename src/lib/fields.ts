// Field definitions for SI and Spotlight forms

import { validateLandingNumbers } from './validation'

export type FieldType = 'text' | 'textarea' | 'url' | 'select' | 'number' | 'date'

export interface FieldDef {
  name: string
  label: string
  type: FieldType
  required?: boolean
  placeholder?: string
  options?: string[]
  full?: boolean // span 2 cols
  multiline?: boolean
  hint?: string
  validate?: (value: string) => string | null
}

export const SI_FIELDS: FieldDef[] = [
  { name: 'siCode', label: 'SI Code', type: 'text', required: true, placeholder: '10001' },
  { name: 'clientCode', label: 'Client Code', type: 'text', required: true, placeholder: 'BL001' },
  { name: 'businessProfileId', label: 'Business Profile ID', type: 'text' },
  { name: 'businessName', label: 'Business / Brand Name', type: 'text', full: true },
  { name: 'alternativeName', label: 'Alternative Name', type: 'text', full: true },
  { name: 'circle', label: 'Circle', type: 'select', options: ['North', 'South', 'East', 'West', 'Central'] },
  { name: 'address1', label: 'Address 1', type: 'text', full: true },
  { name: 'address2', label: 'Address 2', type: 'text' },
  { name: 'locality', label: 'Locality', type: 'text' },
  { name: 'landmark', label: 'Landmark', type: 'text' },
  { name: 'city', label: 'City', type: 'text' },
  { name: 'state', label: 'State', type: 'text' },
  { name: 'postcode', label: 'Postcode', type: 'text' },
  { name: 'latitude', label: 'Latitude', type: 'text' },
  { name: 'longitude', label: 'Longitude', type: 'text' },
  { name: 'googlePlusPage', label: 'Google Plus Page', type: 'url', full: true },
  { name: 'vmnSi', label: 'VMN SI', type: 'text' },
  {
    name: 'salesLandingNumbers',
    label: 'Sales Landing Numbers',
    type: 'text',
    full: true,
    placeholder: '9876543210,9876543211',
    hint: 'Comma-separated 10-digit mobile numbers (max 5)',
    validate: validateLandingNumbers,
  },
  {
    name: 'serviceLandingNumbers',
    label: 'Service Landing Numbers',
    type: 'text',
    full: true,
    placeholder: '9876543212,9876543213',
    hint: 'Comma-separated 10-digit mobile numbers (max 5)',
    validate: validateLandingNumbers,
  },
  {
    name: 'linkedSpotlightCode',
    label: 'Linked Spotlight Client Code',
    type: 'text',
    placeholder: 'PU09A',
    hint: 'When this SI goes live, the linked Spotlight also goes live',
  },
  { name: 'weeklyOff', label: 'Weekly Off', type: 'text' },
  { name: 'businessHours', label: 'Business Hours', type: 'textarea', full: true, multiline: true },
  { name: 'website', label: 'Website', type: 'url', full: true },
  { name: 'placeId', label: 'Place ID', type: 'text', full: true },
  { name: 'locationGroup', label: 'Location Group', type: 'text', full: true },
  {
    name: 'gmbListingStatus',
    label: 'GMB Listing Status',
    type: 'select',
    options: ['verified', 'unverified', 'suspended', 'duplicate', 'pending'],
  },
]

export const SPOTLIGHT_FIELDS: FieldDef[] = [
  { name: 'clientCode', label: 'Client Code', type: 'text', required: true, placeholder: 'PU09A' },
  { name: 'name', label: 'Name', type: 'text', full: true },
  { name: 'alternateName', label: 'Alternate Name', type: 'text', full: true },
  { name: 'internalCode', label: 'Internal Code', type: 'text' },
  { name: 'region', label: 'Region', type: 'select', options: ['North', 'South', 'East', 'West', 'Central'] },
  { name: 'state', label: 'State', type: 'text' },
  { name: 'city', label: 'City', type: 'text' },
  { name: 'country', label: 'Country', type: 'text', placeholder: 'India' },
  { name: 'pincode', label: 'Pincode', type: 'text' },
  { name: 'locality', label: 'Locality', type: 'text' },
  { name: 'addressLine1', label: 'Address Line 1', type: 'text', full: true },
  { name: 'latitude', label: 'Latitude', type: 'text' },
  { name: 'longitude', label: 'Longitude', type: 'text' },
  { name: 'vmn', label: 'VMN', type: 'text' },
  {
    name: 'spotlightLandingNumbers',
    label: 'Spotlight Landing Numbers',
    type: 'text',
    full: true,
    placeholder: '9876543210,9876543211',
    hint: 'Comma-separated 10-digit mobile numbers (max 5)',
    validate: validateLandingNumbers,
  },
  { name: 'domain', label: 'Domain', type: 'url', full: true },
  { name: 'adAccountCid', label: 'AdAccount (CID)', type: 'text' },
  { name: 'facebookPageId', label: 'Facebook Page ID / URL', type: 'text', full: true },
]

// Media Spend form fields
export const MEDIA_SPEND_FIELDS: FieldDef[] = [
  {
    name: 'recordType',
    label: 'Location Type',
    type: 'select',
    required: true,
    options: ['SI', 'Spotlight'],
  },
  {
    name: 'recordCode',
    label: 'Location Code',
    type: 'text',
    required: true,
    placeholder: '10001 (SI) or PU09A (Spotlight)',
    hint: 'SI Code for SI, Client Code for Spotlight',
  },
  {
    name: 'month',
    label: 'Month',
    type: 'text',
    required: true,
    placeholder: '2025-01',
    hint: 'Format: YYYY-MM',
  },
  {
    name: 'allocated',
    label: 'Allocated Budget (INR)',
    type: 'number',
    placeholder: '0',
  },
  {
    name: 'utilized',
    label: 'Utilized (INR)',
    type: 'number',
    placeholder: '0',
  },
  {
    name: 'pendingInWallet',
    label: 'Pending in Wallet (INR)',
    type: 'number',
    placeholder: '0',
    hint: 'Balance carried to next month',
  },
  {
    name: 'notes',
    label: 'Notes',
    type: 'textarea',
    full: true,
    multiline: true,
  },
]

// Platform Fee form fields
export const PLATFORM_FEE_FIELDS: FieldDef[] = [
  {
    name: 'recordType',
    label: 'Location Type',
    type: 'select',
    required: true,
    options: ['SI', 'Spotlight'],
  },
  {
    name: 'recordCode',
    label: 'Location Code',
    type: 'text',
    required: true,
    placeholder: '10001 (SI) or PU09A (Spotlight)',
  },
  {
    name: 'month',
    label: 'Month',
    type: 'text',
    required: true,
    placeholder: '2025-01',
    hint: 'Format: YYYY-MM',
  },
  {
    name: 'baseAmount',
    label: 'Base Amount (INR)',
    type: 'number',
    placeholder: '8060',
  },
  {
    name: 'gstRate',
    label: 'GST Rate (%)',
    type: 'number',
    placeholder: '18',
  },
  {
    name: 'isPaid',
    label: 'Payment Status',
    type: 'select',
    options: ['unpaid', 'paid'],
  },
  {
    name: 'notes',
    label: 'Notes',
    type: 'textarea',
    full: true,
    multiline: true,
  },
]
