// Indian Income Tax Configuration for FY 2024-25 (AY 2025-26)
// Budget 2024 compliant

export interface TaxSlab {
  min: number;
  max: number;
  rate: number;
}

export interface SurchargeSlabs {
  min: number;
  max: number;
  rate: number;
}

export const TAX_CONFIG = {
  FY: "2024-25",
  AY: "2025-26",

  OLD_REGIME: {
    SLABS: [
      { min: 0, max: 250000, rate: 0 },
      { min: 250001, max: 500000, rate: 0.05 },
      { min: 500001, max: 1000000, rate: 0.20 },
      { min: 1000001, max: Infinity, rate: 0.30 },
    ] as TaxSlab[],

    SENIOR_CITIZEN_SLABS: [
      // 60 years and above but below 80 years
      { min: 0, max: 300000, rate: 0 },
      { min: 300001, max: 500000, rate: 0.05 },
      { min: 500001, max: 1000000, rate: 0.20 },
      { min: 1000001, max: Infinity, rate: 0.30 },
    ] as TaxSlab[],

    SUPER_SENIOR_SLABS: [
      // 80 years and above
      { min: 0, max: 500000, rate: 0 },
      { min: 500001, max: 1000000, rate: 0.20 },
      { min: 1000001, max: Infinity, rate: 0.30 },
    ] as TaxSlab[],

    STANDARD_DEDUCTION: 50000,

    DEDUCTIONS: {
      SEC_80C_LIMIT: 150000,
      SEC_80D_SELF: 25000,
      SEC_80D_SELF_SENIOR: 50000,        // if self is senior citizen
      SEC_80D_PARENTS: 25000,
      SEC_80D_PARENTS_SENIOR: 50000,     // if parents are senior citizens
      SEC_80E_UNLIMITED: true,           // interest on education loan – no cap
      SEC_80G_LIMIT_PERCENT: 0.10,       // 10% of adjusted gross total income
      SEC_80TTA_LIMIT: 10000,            // savings bank interest (non-senior)
      SEC_80TTB_LIMIT: 50000,            // interest income for senior citizens
      NPS_80CCD1B: 50000,                // additional NPS contribution
      SEC_80CCD2_EMPLOYER_PERCENT: 0.10, // 10% of salary (basic+DA)
      HUF_80C_LIMIT: 150000,
    },

    REBATE_87A_INCOME_LIMIT: 500000,
    REBATE_87A_AMOUNT: 12500,

    HRA_METRO_PERCENT: 0.50,
    HRA_NON_METRO_PERCENT: 0.40,

    LTA_EXEMPT: true, // LTA exemption available under old regime
  },

  NEW_REGIME: {
    SLABS: [
      { min: 0, max: 300000, rate: 0 },
      { min: 300001, max: 600000, rate: 0.05 },
      { min: 600001, max: 900000, rate: 0.10 },
      { min: 900001, max: 1200000, rate: 0.15 },
      { min: 1200001, max: 1500000, rate: 0.20 },
      { min: 1500001, max: Infinity, rate: 0.30 },
    ] as TaxSlab[],

    STANDARD_DEDUCTION: 75000,           // increased in Budget 2024

    REBATE_87A_INCOME_LIMIT: 700000,     // increased in Budget 2024
    REBATE_87A_AMOUNT: 25000,

    NPS_80CCD2_EMPLOYER_PERCENT: 0.10,   // employer NPS still allowed

    // The following deductions are NOT available under new regime
    DISALLOWED_DEDUCTIONS: [
      "80C", "80D", "80E", "80G", "80TTA", "80TTB", "HRA", "LTA",
      "PROFESSIONAL_TAX", "INTEREST_ON_HOME_LOAN_SELF_OCCUPIED",
    ],
  },

  SURCHARGE: [
    { min: 0, max: 5000000, rate: 0 },
    { min: 5000001, max: 10000000, rate: 0.10 },
    { min: 10000001, max: 20000000, rate: 0.15 },
    { min: 20000001, max: 50000000, rate: 0.25 },
    { min: 50000001, max: Infinity, rate: 0.37 },
  ] as SurchargeSlabs[],

  // Surcharge on LTCG and special rate income is capped at 15% (post Finance Act 2022)
  SURCHARGE_LTCG_CAP: 0.15,

  MARGINAL_RELIEF_SURCHARGE: true,

  HEALTH_EDUCATION_CESS: 0.04,

  // Professional tax limit (deductible)
  PROFESSIONAL_TAX_MAX: 2500,

  // Interest on home loan (self-occupied) – old regime only
  HOME_LOAN_INTEREST_SELF_OCCUPIED_LIMIT: 200000,

  // Interest on home loan (let-out) – no limit but set-off capped
  HOME_LOAN_INTEREST_LETOUT_SETOFF_LIMIT: 200000,

  // LTCG exemption threshold
  LTCG_EXEMPT_LIMIT: 100000,

  // Short term capital gains tax rate (listed equity)
  STCG_LISTED_EQUITY_RATE: 0.15,

  // Long term capital gains tax rate (listed equity, after 1L exemption)
  LTCG_LISTED_EQUITY_RATE: 0.10,

  SENIOR_CITIZEN_AGE: 60,
  SUPER_SENIOR_CITIZEN_AGE: 80,
} as const;

export type TaxConfig = typeof TAX_CONFIG;
