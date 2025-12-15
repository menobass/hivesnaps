/**
 * Safety and compliance configuration for HiveSnaps
 */

export const SAFETY_CONFIG = {
  // Child Safety Standards URL for Google Play compliance
  CHILD_SAFETY_STANDARDS_URL: 'https://menobass.github.io/hivesnaps/child-safety-standards.html',
  
  // Other safety-related URLs
  PRIVACY_POLICY_URL: 'https://menobass.github.io/hivesnaps/privacy-policy.html',
  TERMS_OF_SERVICE_URL: 'https://menobass.github.io/hivesnaps/index.html',
  
  // Emergency contact information
  EMERGENCY_CONTACTS: {
    US_NCMEC: '1-800-843-5678',
    US_EMERGENCY: '911',
    CYBERTIPLINE_URL: 'https://www.missingkids.org/gethelpnow/cybertipline',
  },
  
  // App safety contact
  SAFETY_EMAIL: 'snapieapp@proton.me',
  
  // Report handling configuration
  CHILD_SAFETY_REPORT_PRIORITY: true,
  CHILD_SAFETY_RESPONSE_TIME_HOURS: 2,
} as const;

export type SafetyConfig = typeof SAFETY_CONFIG;