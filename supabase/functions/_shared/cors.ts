// Allowlist of origins that are allowed to access this function
// export const ALLOWED_ORIGIN_PATTERNS = [
//   // Add your client origin patterns here
//   // e.g. /^https:\/\/myapp\.com$/,
//   //      /^http:\/\/localhost:3000$/,
// ];

// Standard CORS headers
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Or specify your allowed origins
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE', // Add methods as needed
};
