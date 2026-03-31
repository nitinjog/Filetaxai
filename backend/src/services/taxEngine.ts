import { TAX_CONFIG, TaxSlab } from "../utils/taxConfig";

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface IncomeData {
  // Employment
  gross_salary: number;
  basic_salary: number;
  hra_received: number;
  city_type: "METRO" | "NON_METRO";
  rent_paid_annual: number;
  special_allowance: number;
  other_allowances: number;
  bonus: number;
  lta_received: number;
  lta_claimed: number;

  // Other income
  interest_income: number;
  rental_income: number;
  capital_gains_short: number;   // listed equity STCG @ 15%
  capital_gains_long: number;    // listed equity LTCG (taxed at 10% over 1L)
  other_income: number;

  // Deductions (Old Regime)
  sec_80c: number;
  sec_80d_self: number;
  sec_80d_parents: number;
  sec_80d_parents_senior: boolean;
  sec_80e: number;
  sec_80g: number;
  sec_80tta: number;
  nps_80ccd1b: number;
  nps_employer_80ccd2: number;

  // TDS
  tds_employer: number;
  tds_other: number;
  advance_tax: number;

  // Personal
  age: number;
  pan: string;
}

export interface TaxSlabBreakdown {
  slab_label: string;
  income_in_slab: number;
  rate: number;
  tax: number;
}

export interface RegimeResult {
  gross_income: number;
  exemptions: Record<string, number>;
  deductions: Record<string, number>;
  taxable_income: number;
  tax_on_income: number;
  surcharge: number;
  cess: number;
  total_tax: number;
  rebate_87a: number;
  net_tax_payable: number;
  tds_deducted: number;
  refund_or_payable: number;  // positive = refund, negative = payable
  effective_rate: number;     // as a percentage
  marginal_rate: number;      // as a percentage
  breakdown: TaxSlabBreakdown[];
}

export interface TaxComparisonResult {
  old_regime: RegimeResult;
  new_regime: RegimeResult;
  recommended_regime: "OLD" | "NEW";
  savings_amount: number;
  savings_percentage: number;
  recommendation_reason: string;
}

// ─── Helper: Round to nearest rupee ──────────────────────────────────────────

function roundToRupee(n: number): number {
  return Math.round(n);
}

// ─── Helper: Clamp a value between 0 and a max ───────────────────────────────

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// ─── Helper: Compute tax on income using given slabs ─────────────────────────

function computeTaxOnSlabs(
  income: number,
  slabs: readonly TaxSlab[]
): { tax: number; breakdown: TaxSlabBreakdown[] } {
  let tax = 0;
  const breakdown: TaxSlabBreakdown[] = [];

  for (const slab of slabs) {
    if (income <= 0) break;
    if (income <= slab.min - 1) break;

    const slabMax = slab.max === Infinity ? income : slab.max;
    const incomeInSlab = Math.min(income, slabMax) - (slab.min - 1);

    if (incomeInSlab <= 0) continue;

    const taxInSlab = incomeInSlab * slab.rate;
    tax += taxInSlab;

    if (taxInSlab > 0 || slab.rate === 0) {
      const slabLabel =
        slab.max === Infinity
          ? `Above ₹${(slab.min).toLocaleString("en-IN")}`
          : `₹${slab.min.toLocaleString("en-IN")} – ₹${slab.max.toLocaleString("en-IN")}`;

      breakdown.push({
        slab_label: slabLabel,
        income_in_slab: roundToRupee(incomeInSlab),
        rate: slab.rate * 100,
        tax: roundToRupee(taxInSlab),
      });
    }
  }

  return { tax: roundToRupee(tax), breakdown };
}

// ─── Determine applicable slabs based on age (old regime) ────────────────────

function getOldRegimeSlabs(age: number): readonly TaxSlab[] {
  if (age >= TAX_CONFIG.SUPER_SENIOR_CITIZEN_AGE) {
    return TAX_CONFIG.OLD_REGIME.SUPER_SENIOR_SLABS;
  }
  if (age >= TAX_CONFIG.SENIOR_CITIZEN_AGE) {
    return TAX_CONFIG.OLD_REGIME.SENIOR_CITIZEN_SLABS;
  }
  return TAX_CONFIG.OLD_REGIME.SLABS;
}

// ─── HRA Exemption (Section 10(13A)) ─────────────────────────────────────────
// Least of the three conditions:
// 1. Actual HRA received
// 2. 50% (metro) or 40% (non-metro) of basic salary
// 3. Excess of rent paid over 10% of basic salary

export function computeHRAExemption(data: IncomeData): number {
  const { hra_received, basic_salary, city_type, rent_paid_annual } = data;

  if (hra_received <= 0 || rent_paid_annual <= 0) return 0;

  const condition1 = hra_received;

  const metroPercent = TAX_CONFIG.OLD_REGIME.HRA_METRO_PERCENT;
  const nonMetroPercent = TAX_CONFIG.OLD_REGIME.HRA_NON_METRO_PERCENT;
  const condition2 =
    city_type === "METRO"
      ? basic_salary * metroPercent
      : basic_salary * nonMetroPercent;

  const condition3 = Math.max(0, rent_paid_annual - basic_salary * 0.1);

  const exemption = Math.min(condition1, condition2, condition3);
  return roundToRupee(Math.max(0, exemption));
}

// ─── Section 87A Rebate ───────────────────────────────────────────────────────

export function computeRebate87A(
  taxableIncome: number,
  taxBeforeRebate: number,
  regime: "OLD" | "NEW"
): number {
  const limit =
    regime === "OLD"
      ? TAX_CONFIG.OLD_REGIME.REBATE_87A_INCOME_LIMIT
      : TAX_CONFIG.NEW_REGIME.REBATE_87A_INCOME_LIMIT;

  const rebateAmt =
    regime === "OLD"
      ? TAX_CONFIG.OLD_REGIME.REBATE_87A_AMOUNT
      : TAX_CONFIG.NEW_REGIME.REBATE_87A_AMOUNT;

  if (taxableIncome <= limit) {
    return Math.min(taxBeforeRebate, rebateAmt);
  }
  return 0;
}

// ─── Surcharge with Marginal Relief ──────────────────────────────────────────

export function computeSurcharge(income: number, taxBeforeSurcharge: number): number {
  const surchargeSlabs = TAX_CONFIG.SURCHARGE;

  // Determine applicable surcharge rate
  let surchargeRate = 0;
  for (const slab of surchargeSlabs) {
    if (income >= slab.min) {
      surchargeRate = slab.rate;
    }
  }

  if (surchargeRate === 0) return 0;

  const rawSurcharge = taxBeforeSurcharge * surchargeRate;

  if (!TAX_CONFIG.MARGINAL_RELIEF_SURCHARGE) {
    return roundToRupee(rawSurcharge);
  }

  // Marginal relief: total tax + surcharge should not exceed
  // (tax at threshold + surcharge at threshold) + (income - threshold)
  // i.e., the additional tax from surcharge should not exceed income exceeding the threshold

  // Find the lower threshold
  const applicableSlab = surchargeSlabs.find(
    (s) => income >= s.min && (s.max === Infinity || income <= s.max)
  );

  if (!applicableSlab) return 0;

  const threshold = applicableSlab.min;
  const incomeExceedingThreshold = income - threshold + 1; // +1 because slabs are 1-indexed

  // Tax that would have been payable had income been exactly at threshold
  // Re-compute tax at threshold using same slabs (approximate using income slabs)
  // Marginal relief = ensure extra tax (surcharge) <= income exceeding threshold
  const maxExtraTax = incomeExceedingThreshold;
  const surchargeWithRelief = Math.min(rawSurcharge, maxExtraTax);

  return roundToRupee(Math.max(0, surchargeWithRelief));
}

// ─── Health & Education Cess ──────────────────────────────────────────────────

export function computeCess(taxAfterRebate: number): number {
  return roundToRupee(taxAfterRebate * TAX_CONFIG.HEALTH_EDUCATION_CESS);
}

// ─── Marginal Tax Rate ────────────────────────────────────────────────────────

function getMarginalRate(taxableIncome: number, slabs: readonly TaxSlab[]): number {
  for (let i = slabs.length - 1; i >= 0; i--) {
    const slab = slabs[i];
    if (taxableIncome > slab.min) {
      return slab.rate * 100;
    }
  }
  return 0;
}

// ─── Old Regime Computation ───────────────────────────────────────────────────

export function computeOldRegime(data: IncomeData): RegimeResult {
  const cfg = TAX_CONFIG.OLD_REGIME;
  const deductions = cfg.DEDUCTIONS;
  const isSenior = data.age >= TAX_CONFIG.SENIOR_CITIZEN_AGE;

  // ── Gross Salary ─────────────────────────────────────────────────────────
  const grossSalary = data.gross_salary;

  // ── Exemptions ────────────────────────────────────────────────────────────
  const exemptions: Record<string, number> = {};

  // HRA exemption
  const hraExemption = computeHRAExemption(data);
  if (hraExemption > 0) {
    exemptions["HRA (Section 10(13A))"] = hraExemption;
  }

  // LTA exemption (Section 10(5)) – claimed amount
  const ltaClaimed = Math.min(data.lta_claimed, data.lta_received);
  if (ltaClaimed > 0) {
    exemptions["LTA (Section 10(5))"] = ltaClaimed;
  }

  // Standard deduction (Section 16(ia))
  const standardDeduction = Math.min(cfg.STANDARD_DEDUCTION, grossSalary);
  exemptions["Standard Deduction (Section 16(ia))"] = standardDeduction;

  const totalExemptions = Object.values(exemptions).reduce((a, b) => a + b, 0);

  // ── Income from Salary (after exemptions) ────────────────────────────────
  const salaryAfterExemptions = Math.max(0, grossSalary - totalExemptions);

  // ── Other Income ──────────────────────────────────────────────────────────
  const interestIncome = data.interest_income;
  const rentalIncome = data.rental_income; // assuming net (after 30% standard deduction already applied or user-provided net)
  // Capital gains are taxed separately (not added to normal income for slab calculation)
  const otherIncome = data.other_income;

  // ── Gross Total Income ───────────────────────────────────────────────────
  const grossTotalIncome =
    salaryAfterExemptions + interestIncome + rentalIncome + otherIncome;

  // ── Chapter VI-A Deductions ───────────────────────────────────────────────
  const deductionsMap: Record<string, number> = {};

  // 80C (capped at 1.5L)
  const sec80c = clamp(data.sec_80c, 0, deductions.SEC_80C_LIMIT);
  if (sec80c > 0) deductionsMap["Section 80C"] = sec80c;

  // 80D – health insurance
  const sec80dSelfLimit = isSenior
    ? deductions.SEC_80D_SELF_SENIOR
    : deductions.SEC_80D_SELF;
  const sec80dSelf = clamp(data.sec_80d_self, 0, sec80dSelfLimit);
  if (sec80dSelf > 0) deductionsMap["Section 80D (Self & Family)"] = sec80dSelf;

  const sec80dParentsLimit = data.sec_80d_parents_senior
    ? deductions.SEC_80D_PARENTS_SENIOR
    : deductions.SEC_80D_PARENTS;
  const sec80dParents = clamp(data.sec_80d_parents, 0, sec80dParentsLimit);
  if (sec80dParents > 0) deductionsMap["Section 80D (Parents)"] = sec80dParents;

  // 80E – education loan interest (unlimited)
  if (data.sec_80e > 0) deductionsMap["Section 80E (Education Loan)"] = data.sec_80e;

  // 80G – donations (capped at 10% of gross total income, eligible portion)
  const sec80gLimit = grossTotalIncome * deductions.SEC_80G_LIMIT_PERCENT;
  const sec80g = clamp(data.sec_80g, 0, sec80gLimit);
  if (sec80g > 0) deductionsMap["Section 80G (Donations)"] = roundToRupee(sec80g);

  // 80TTA / 80TTB – savings interest
  if (isSenior) {
    const sec80ttb = clamp(data.sec_80tta, 0, deductions.SEC_80TTB_LIMIT);
    if (sec80ttb > 0)
      deductionsMap["Section 80TTB (Interest – Senior Citizen)"] = sec80ttb;
  } else {
    const sec80tta = clamp(data.sec_80tta, 0, deductions.SEC_80TTA_LIMIT);
    if (sec80tta > 0)
      deductionsMap["Section 80TTA (Savings Bank Interest)"] = sec80tta;
  }

  // 80CCD(1B) – additional NPS (capped at 50K)
  const nps80ccd1b = clamp(data.nps_80ccd1b, 0, deductions.NPS_80CCD1B);
  if (nps80ccd1b > 0)
    deductionsMap["Section 80CCD(1B) (NPS – Additional)"] = nps80ccd1b;

  // 80CCD(2) – employer NPS contribution (capped at 10% of basic+DA)
  const nps80ccd2Limit =
    data.basic_salary * deductions.SEC_80CCD2_EMPLOYER_PERCENT;
  const nps80ccd2 = clamp(data.nps_employer_80ccd2, 0, nps80ccd2Limit);
  if (nps80ccd2 > 0)
    deductionsMap["Section 80CCD(2) (Employer NPS)"] = roundToRupee(nps80ccd2);

  const totalDeductions = Object.values(deductionsMap).reduce((a, b) => a + b, 0);

  // ── Taxable Income ────────────────────────────────────────────────────────
  const taxableIncome = Math.max(0, roundToRupee(grossTotalIncome - totalDeductions));

  // ── Tax on Normal Income (slabs) ──────────────────────────────────────────
  const slabs = getOldRegimeSlabs(data.age);
  const { tax: taxOnNormalIncome, breakdown } = computeTaxOnSlabs(taxableIncome, slabs);

  // ── Capital Gains Tax ─────────────────────────────────────────────────────
  // STCG on listed equity @ 15%
  const stcgTax = roundToRupee(
    Math.max(0, data.capital_gains_short) * TAX_CONFIG.STCG_LISTED_EQUITY_RATE
  );

  // LTCG on listed equity @ 10% over 1L
  const ltcgTaxable = Math.max(
    0,
    data.capital_gains_long - TAX_CONFIG.LTCG_EXEMPT_LIMIT
  );
  const ltcgTax = roundToRupee(ltcgTaxable * TAX_CONFIG.LTCG_LISTED_EQUITY_RATE);

  const totalTaxOnIncome = taxOnNormalIncome + stcgTax + ltcgTax;

  // ── Rebate 87A ────────────────────────────────────────────────────────────
  // 87A rebate is available only on normal income (not STCG/LTCG at special rates)
  const rebate87a = computeRebate87A(taxableIncome, taxOnNormalIncome, "OLD");

  const taxAfterRebate = Math.max(0, taxOnNormalIncome - rebate87a) + stcgTax + ltcgTax;

  // ── Surcharge ─────────────────────────────────────────────────────────────
  const totalIncomeForSurcharge = taxableIncome + data.capital_gains_short + data.capital_gains_long;
  const surcharge = computeSurcharge(totalIncomeForSurcharge, taxAfterRebate);

  // ── Cess ──────────────────────────────────────────────────────────────────
  const cess = computeCess(taxAfterRebate + surcharge);

  // ── Total Tax ─────────────────────────────────────────────────────────────
  const totalTax = roundToRupee(taxAfterRebate + surcharge + cess);

  // ── TDS & Advance Tax ─────────────────────────────────────────────────────
  const totalTDS = data.tds_employer + data.tds_other + data.advance_tax;

  // Positive = refund, Negative = balance payable
  const refundOrPayable = roundToRupee(totalTDS - totalTax);

  // ── Rates ─────────────────────────────────────────────────────────────────
  const effectiveRate =
    grossTotalIncome > 0
      ? roundToRupee(((totalTax / grossTotalIncome) * 100) * 100) / 100
      : 0;
  const marginalRate = getMarginalRate(taxableIncome, slabs);

  return {
    gross_income: roundToRupee(grossTotalIncome),
    exemptions,
    deductions: deductionsMap,
    taxable_income: taxableIncome,
    tax_on_income: totalTaxOnIncome,
    surcharge,
    cess,
    total_tax: totalTax,
    rebate_87a: rebate87a,
    net_tax_payable: totalTax,
    tds_deducted: roundToRupee(totalTDS),
    refund_or_payable: refundOrPayable,
    effective_rate: effectiveRate,
    marginal_rate: marginalRate,
    breakdown,
  };
}

// ─── New Regime Computation ───────────────────────────────────────────────────

export function computeNewRegime(data: IncomeData): RegimeResult {
  const cfg = TAX_CONFIG.NEW_REGIME;

  // ── Gross Salary ─────────────────────────────────────────────────────────
  const grossSalary = data.gross_salary;

  // ── Exemptions ────────────────────────────────────────────────────────────
  const exemptions: Record<string, number> = {};

  // Standard deduction (Section 16(ia)) – increased to 75K in new regime
  const standardDeduction = Math.min(cfg.STANDARD_DEDUCTION, grossSalary);
  exemptions["Standard Deduction (Section 16(ia))"] = standardDeduction;

  // No HRA, LTA exemptions in new regime
  const totalExemptions = Object.values(exemptions).reduce((a, b) => a + b, 0);

  // ── Income from Salary ────────────────────────────────────────────────────
  const salaryAfterExemptions = Math.max(0, grossSalary - totalExemptions);

  // ── Other Income ──────────────────────────────────────────────────────────
  const otherIncome =
    data.interest_income + data.rental_income + data.other_income;

  // ── Gross Total Income ────────────────────────────────────────────────────
  const grossTotalIncome = salaryAfterExemptions + otherIncome;

  // ── Deductions (very limited under new regime) ────────────────────────────
  const deductionsMap: Record<string, number> = {};

  // 80CCD(2) – employer NPS contribution is still allowed in new regime
  const nps80ccd2Limit =
    data.basic_salary * cfg.NPS_80CCD2_EMPLOYER_PERCENT;
  const nps80ccd2 = clamp(data.nps_employer_80ccd2, 0, nps80ccd2Limit);
  if (nps80ccd2 > 0)
    deductionsMap["Section 80CCD(2) (Employer NPS)"] = roundToRupee(nps80ccd2);

  const totalDeductions = Object.values(deductionsMap).reduce((a, b) => a + b, 0);

  // ── Taxable Income ────────────────────────────────────────────────────────
  const taxableIncome = Math.max(0, roundToRupee(grossTotalIncome - totalDeductions));

  // ── Tax on Normal Income (slabs) ──────────────────────────────────────────
  const { tax: taxOnNormalIncome, breakdown } = computeTaxOnSlabs(
    taxableIncome,
    cfg.SLABS
  );

  // ── Capital Gains Tax ─────────────────────────────────────────────────────
  const stcgTax = roundToRupee(
    Math.max(0, data.capital_gains_short) * TAX_CONFIG.STCG_LISTED_EQUITY_RATE
  );
  const ltcgTaxable = Math.max(
    0,
    data.capital_gains_long - TAX_CONFIG.LTCG_EXEMPT_LIMIT
  );
  const ltcgTax = roundToRupee(ltcgTaxable * TAX_CONFIG.LTCG_LISTED_EQUITY_RATE);

  const totalTaxOnIncome = taxOnNormalIncome + stcgTax + ltcgTax;

  // ── Rebate 87A ────────────────────────────────────────────────────────────
  const rebate87a = computeRebate87A(taxableIncome, taxOnNormalIncome, "NEW");

  const taxAfterRebate = Math.max(0, taxOnNormalIncome - rebate87a) + stcgTax + ltcgTax;

  // ── Surcharge ─────────────────────────────────────────────────────────────
  const totalIncomeForSurcharge =
    taxableIncome + data.capital_gains_short + data.capital_gains_long;
  const surcharge = computeSurcharge(totalIncomeForSurcharge, taxAfterRebate);

  // ── Cess ──────────────────────────────────────────────────────────────────
  const cess = computeCess(taxAfterRebate + surcharge);

  // ── Total Tax ─────────────────────────────────────────────────────────────
  const totalTax = roundToRupee(taxAfterRebate + surcharge + cess);

  // ── TDS & Advance Tax ─────────────────────────────────────────────────────
  const totalTDS = data.tds_employer + data.tds_other + data.advance_tax;
  const refundOrPayable = roundToRupee(totalTDS - totalTax);

  // ── Rates ─────────────────────────────────────────────────────────────────
  const effectiveRate =
    grossTotalIncome > 0
      ? roundToRupee(((totalTax / grossTotalIncome) * 100) * 100) / 100
      : 0;
  const marginalRate = getMarginalRate(taxableIncome, cfg.SLABS);

  return {
    gross_income: roundToRupee(grossTotalIncome),
    exemptions,
    deductions: deductionsMap,
    taxable_income: taxableIncome,
    tax_on_income: totalTaxOnIncome,
    surcharge,
    cess,
    total_tax: totalTax,
    rebate_87a: rebate87a,
    net_tax_payable: totalTax,
    tds_deducted: roundToRupee(totalTDS),
    refund_or_payable: refundOrPayable,
    effective_rate: effectiveRate,
    marginal_rate: marginalRate,
    breakdown,
  };
}

// ─── Compare Regimes & Recommend ─────────────────────────────────────────────

export function compareTaxRegimes(data: IncomeData): TaxComparisonResult {
  const oldRegime = computeOldRegime(data);
  const newRegime = computeNewRegime(data);

  const oldTax = oldRegime.net_tax_payable;
  const newTax = newRegime.net_tax_payable;

  const recommended: "OLD" | "NEW" = oldTax <= newTax ? "OLD" : "NEW";
  const savingsAmount = Math.abs(oldTax - newTax);
  const higherTax = Math.max(oldTax, newTax);
  const savingsPercentage =
    higherTax > 0 ? roundToRupee((savingsAmount / higherTax) * 100 * 100) / 100 : 0;

  let recommendationReason = "";

  if (recommended === "OLD") {
    const deductionTotal = Object.values(oldRegime.deductions).reduce(
      (a, b) => a + b,
      0
    );
    const exemptionTotal = Object.values(oldRegime.exemptions).reduce(
      (a, b) => a + b,
      0
    );

    recommendationReason =
      `Old Regime saves ₹${savingsAmount.toLocaleString("en-IN")} (${savingsPercentage}%) ` +
      `compared to New Regime. Your total deductions of ₹${deductionTotal.toLocaleString("en-IN")} ` +
      `and exemptions of ₹${exemptionTotal.toLocaleString("en-IN")} make Old Regime more ` +
      `beneficial. Key deductions: ${Object.keys(oldRegime.deductions)
        .slice(0, 3)
        .join(", ")}.`;
  } else {
    recommendationReason =
      `New Regime saves ₹${savingsAmount.toLocaleString("en-IN")} (${savingsPercentage}%) ` +
      `compared to Old Regime. Despite losing deductions, the lower slab rates and ` +
      `higher standard deduction (₹75,000) under New Regime result in lower tax. ` +
      `Consider switching to New Regime for simplicity and savings.`;
  }

  return {
    old_regime: oldRegime,
    new_regime: newRegime,
    recommended_regime: recommended,
    savings_amount: savingsAmount,
    savings_percentage: savingsPercentage,
    recommendation_reason: recommendationReason,
  };
}

// ─── Generate Tax Breakdown for UI ───────────────────────────────────────────

export function generateTaxBreakdown(result: RegimeResult): {
  summary: Record<string, string | number>;
  slab_breakdown: TaxSlabBreakdown[];
  exemption_details: { name: string; amount: number }[];
  deduction_details: { name: string; amount: number }[];
} {
  const summary: Record<string, string | number> = {
    "Gross Income": `₹${result.gross_income.toLocaleString("en-IN")}`,
    "Total Exemptions": `₹${Object.values(result.exemptions)
      .reduce((a, b) => a + b, 0)
      .toLocaleString("en-IN")}`,
    "Total Deductions": `₹${Object.values(result.deductions)
      .reduce((a, b) => a + b, 0)
      .toLocaleString("en-IN")}`,
    "Taxable Income": `₹${result.taxable_income.toLocaleString("en-IN")}`,
    "Tax on Income": `₹${result.tax_on_income.toLocaleString("en-IN")}`,
    "Section 87A Rebate": `₹${result.rebate_87a.toLocaleString("en-IN")}`,
    Surcharge: `₹${result.surcharge.toLocaleString("en-IN")}`,
    "Health & Education Cess (4%)": `₹${result.cess.toLocaleString("en-IN")}`,
    "Total Tax Payable": `₹${result.net_tax_payable.toLocaleString("en-IN")}`,
    "TDS Deducted": `₹${result.tds_deducted.toLocaleString("en-IN")}`,
    "Refund / Balance Payable":
      result.refund_or_payable >= 0
        ? `Refund: ₹${result.refund_or_payable.toLocaleString("en-IN")}`
        : `Payable: ₹${Math.abs(result.refund_or_payable).toLocaleString("en-IN")}`,
    "Effective Tax Rate": `${result.effective_rate}%`,
    "Marginal Tax Rate": `${result.marginal_rate}%`,
  };

  const exemptionDetails = Object.entries(result.exemptions).map(
    ([name, amount]) => ({ name, amount })
  );

  const deductionDetails = Object.entries(result.deductions).map(
    ([name, amount]) => ({ name, amount })
  );

  return {
    summary,
    slab_breakdown: result.breakdown,
    exemption_details: exemptionDetails,
    deduction_details: deductionDetails,
  };
}

// ─── Default IncomeData factory ───────────────────────────────────────────────

export function createDefaultIncomeData(): IncomeData {
  return {
    gross_salary: 0,
    basic_salary: 0,
    hra_received: 0,
    city_type: "NON_METRO",
    rent_paid_annual: 0,
    special_allowance: 0,
    other_allowances: 0,
    bonus: 0,
    lta_received: 0,
    lta_claimed: 0,
    interest_income: 0,
    rental_income: 0,
    capital_gains_short: 0,
    capital_gains_long: 0,
    other_income: 0,
    sec_80c: 0,
    sec_80d_self: 0,
    sec_80d_parents: 0,
    sec_80d_parents_senior: false,
    sec_80e: 0,
    sec_80g: 0,
    sec_80tta: 0,
    nps_80ccd1b: 0,
    nps_employer_80ccd2: 0,
    tds_employer: 0,
    tds_other: 0,
    advance_tax: 0,
    age: 30,
    pan: "",
  };
}
