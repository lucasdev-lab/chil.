/* Chil settings. REQUIRE_ACTIVATION must stay true in the version you sell. */
window.CHIL_CONFIG = {
  REQUIRE_ACTIVATION: true,
  VERSION: '1.0.7',
  // Shown on the activation and renewal screens. Fill these in before you start selling.
  SELLER_NAME: '',
  SELLER_WHATSAPP: '254728983936',   // e.g. 254712345678 (no plus, no spaces)
  PAY_INSTRUCTIONS: '',  // e.g. Pay to M-Pesa Till 123456. 1 month Ksh 500, 3 months Ksh 1,350, 6 months Ksh 2,400, 12 months Ksh 4,200.
  WARN_DAYS: 7,          // show the "subscription ends soon" banner this many days before the end
  GRACE_DAYS: 1,         // extra days after the end date before the app locks
  // Copies you want to switch off. Paste Device IDs from your code maker (it writes this list for you), then upload this file again.
  BLOCKED: [],
  PUBLIC_KEY_JWK: {"kty":"EC","crv":"P-256","x":"F0dhj_ciVUMtPG-4qB7nKpZ1CHa_nZn15JlJHCSv-6w","y":"GfIBI4qD7Du8RhpDiDrF105f2g0j0jE--rnRUE0rQMM"}
};
