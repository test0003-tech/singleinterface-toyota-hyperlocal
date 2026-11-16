// Field definitions for SI and Spotlight forms

export type FieldType = 'text' | 'textarea' | 'url' | 'select'

export interface FieldDef {
  name: string
  label: string
  type: FieldType
  required?: boolean
  placeholder?: string
  options?: string[]
  full?: boolean // span 2 cols
  multiline?: boolean
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
  { name: 'domain', label: 'Domain', type: 'url', full: true },
  { name: 'adAccountCid', label: 'AdAccount (CID)', type: 'text' },
  { name: 'facebookPageId', label: 'Facebook Page ID / URL', type: 'text', full: true },
]
