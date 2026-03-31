import pdfParse from "pdf-parse";
import Tesseract from "tesseract.js";
import { IncomeData, createDefaultIncomeData } from "./taxEngine";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedForm16 {
  employer_name: string;
  employer_tan: string;
  employee_name: string;
  employee_pan: string;
  assessment_year: string;
  financial_year: string;
  gross_salary: number;
  basic_salary: number;
  hra_received: number;
  special_allowance: number;
  other_allowances: number;
  bonus: number;
  lta_received: number;
  standard_deduction: number;
  professional_tax: number;
  net_taxable_salary: number;
  sec_80c_details: Record<string, number>;
  sec_80c_total: number;
  sec_80d_self: number;
  sec_80d_parents: number;
  nps_80ccd1b: number;
  tds_deducted: number;
  tds_q1: number;
  tds_q2: number;
  tds_q3: number;
  tds_q4: number;
  raw_text: string;
}

export interface ParsedForm26AS {
  pan: string;
  name: string;
  assessment_year: string;
  tds_entries: TDSEntry[];
  tcs_entries: TCSTaxEntry[];
  advance_tax: number;
  self_assessment_tax: number;
  total_tds: number;
  raw_text: string;
}

export interface TDSEntry {
  deductor_name: string;
  deductor_tan: string;
  section: string;
  amount_paid: number;
  tds_deducted: number;
  tds_deposited: number;
}

export interface TCSTaxEntry {
  collector_name: string;
  collector_tan: string;
  amount_received: number;
  tcs_collected: number;
}

export interface ParsedAIS {
  pan: string;
  assessment_year: string;
  salary_reported: number;
  interest_income: number;
  dividend_income: number;
  sale_of_securities: number;
  sale_of_immovable_property: number;
  foreign_remittance: number;
  gst_turnover: number;
  rent_received: number;
  raw_text: string;
}

export interface ParsedSalarySlip {
  month: string;
  year: number;
  basic_salary: number;
  hra: number;
  special_allowance: number;
  conveyance_allowance: number;
  medical_allowance: number;
  lta: number;
  bonus: number;
  other_allowances: number;
  gross_salary: number;
  professional_tax: number;
  pf_employee: number;
  esic: number;
  tds: number;
  other_deductions: number;
  net_salary: number;
}

export type ParsedDocument =
  | { type: "FORM16"; data: ParsedForm16 }
  | { type: "FORM26AS"; data: ParsedForm26AS }
  | { type: "AIS"; data: ParsedAIS }
  | { type: "SALARY_SLIP"; data: ParsedSalarySlip[] }
  | { type: "OTHER"; data: { raw_text: string } };

// ─── Text Extraction ──────────────────────────────────────────────────────────

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const result = await pdfParse(buffer);
    return result.text || "";
  } catch (err) {
    throw new Error(`PDF parsing failed: ${(err as Error).message}`);
  }
}

export async function extractTextFromImage(buffer: Buffer): Promise<string> {
  try {
    const worker = await Tesseract.createWorker("eng");
    const { data } = await worker.recognize(buffer);
    await worker.terminate();
    return data.text || "";
  } catch (err) {
    throw new Error(`OCR extraction failed: ${(err as Error).message}`);
  }
}

export async function extractText(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  if (mimeType === "application/pdf") {
    return extractTextFromPDF(buffer);
  }
  if (mimeType.startsWith("image/")) {
    return extractTextFromImage(buffer);
  }
  throw new Error(`Unsupported MIME type: ${mimeType}`);
}

// ─── Regex Helpers ────────────────────────────────────────────────────────────

function extractAmount(text: string, patterns: RegExp[]): number {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const raw = match[1].replace(/,/g, "").trim();
      const num = parseFloat(raw);
      if (!isNaN(num)) return num;
    }
  }
  return 0;
}

function extractString(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

// ─── Form 16 Parser ───────────────────────────────────────────────────────────

export async function parseForm16(
  buffer: Buffer,
  mimeType: string
): Promise<ParsedForm16> {
  const rawText = await extractText(buffer, mimeType);
  const text = rawText.toUpperCase();

  const result: ParsedForm16 = {
    employer_name: extractString(rawText, [
      /Name\s+of\s+Employer[:\s]+([^\n]+)/i,
      /Employer['s]*\s+Name[:\s]+([^\n]+)/i,
      /Name\s+and\s+Address\s+of\s+Employer[:\s]+([^\n]+)/i,
    ]),
    employer_tan: extractString(rawText, [
      /TAN\s+of\s+Employer[:\s]+([A-Z]{4}[0-9]{5}[A-Z])/i,
      /TAN[:\s]+([A-Z]{4}[0-9]{5}[A-Z])/i,
    ]),
    employee_name: extractString(rawText, [
      /Name\s+of\s+Employee[:\s]+([^\n]+)/i,
      /Employee['s]*\s+Name[:\s]+([^\n]+)/i,
    ]),
    employee_pan: extractString(rawText, [
      /PAN\s+of\s+Employee[:\s]+([A-Z]{5}[0-9]{4}[A-Z])/i,
      /Employee\s+PAN[:\s]+([A-Z]{5}[0-9]{4}[A-Z])/i,
    ]),
    assessment_year: extractString(rawText, [
      /Assessment\s+Year[:\s]+(\d{4}-\d{2,4})/i,
      /A\.?Y\.?[:\s]+(\d{4}-\d{2,4})/i,
    ]),
    financial_year: extractString(rawText, [
      /Financial\s+Year[:\s]+(\d{4}-\d{2,4})/i,
      /F\.?Y\.?[:\s]+(\d{4}-\d{2,4})/i,
    ]),
    gross_salary: extractAmount(rawText, [
      /Gross\s+Salary[:\s]+([\d,]+\.?\d*)/i,
      /Total\s+Gross\s+Salary[:\s]+([\d,]+\.?\d*)/i,
      /(?:a\)|1\))\s*Salary[:\s]+([\d,]+\.?\d*)/i,
    ]),
    basic_salary: extractAmount(rawText, [
      /Basic\s+Salary[:\s]+([\d,]+\.?\d*)/i,
      /Basic\s+Pay[:\s]+([\d,]+\.?\d*)/i,
    ]),
    hra_received: extractAmount(rawText, [
      /House\s+Rent\s+Allowance[:\s]+([\d,]+\.?\d*)/i,
      /HRA\s+Received[:\s]+([\d,]+\.?\d*)/i,
    ]),
    special_allowance: extractAmount(rawText, [
      /Special\s+Allowance[:\s]+([\d,]+\.?\d*)/i,
    ]),
    other_allowances: extractAmount(rawText, [
      /Other\s+Allowances[:\s]+([\d,]+\.?\d*)/i,
    ]),
    bonus: extractAmount(rawText, [
      /Bonus[:\s]+([\d,]+\.?\d*)/i,
      /Performance\s+Bonus[:\s]+([\d,]+\.?\d*)/i,
    ]),
    lta_received: extractAmount(rawText, [
      /Leave\s+Travel\s+(?:Allowance|Concession)[:\s]+([\d,]+\.?\d*)/i,
      /LTA[:\s]+([\d,]+\.?\d*)/i,
    ]),
    standard_deduction: extractAmount(rawText, [
      /Standard\s+Deduction[:\s]+([\d,]+\.?\d*)/i,
      /Deduction\s+u\/s\s+16\(ia\)[:\s]+([\d,]+\.?\d*)/i,
    ]),
    professional_tax: extractAmount(rawText, [
      /Professional\s+Tax[:\s]+([\d,]+\.?\d*)/i,
      /Entertainment\s+Allowance[:\s]+([\d,]+\.?\d*)/i,
    ]),
    net_taxable_salary: extractAmount(rawText, [
      /Net\s+Taxable\s+Salary[:\s]+([\d,]+\.?\d*)/i,
      /Income\s+from\s+Salary[:\s]+([\d,]+\.?\d*)/i,
    ]),
    sec_80c_details: {},
    sec_80c_total: extractAmount(rawText, [
      /80C[:\s]+([\d,]+\.?\d*)/i,
      /Total\s+(?:investment|deduction)\s+under\s+80C[:\s]+([\d,]+\.?\d*)/i,
    ]),
    sec_80d_self: extractAmount(rawText, [
      /80D\s+Self[:\s]+([\d,]+\.?\d*)/i,
      /Medical\s+Insurance\s+(?:Self|Employee)[:\s]+([\d,]+\.?\d*)/i,
    ]),
    sec_80d_parents: extractAmount(rawText, [
      /80D\s+Parents[:\s]+([\d,]+\.?\d*)/i,
      /Medical\s+Insurance\s+Parents[:\s]+([\d,]+\.?\d*)/i,
    ]),
    nps_80ccd1b: extractAmount(rawText, [
      /80CCD\(1B\)[:\s]+([\d,]+\.?\d*)/i,
      /NPS\s+Additional[:\s]+([\d,]+\.?\d*)/i,
    ]),
    tds_deducted: extractAmount(rawText, [
      /(?:Total\s+)?TDS\s+(?:Deducted|Deposited)[:\s]+([\d,]+\.?\d*)/i,
      /Tax\s+Deducted\s+at\s+Source[:\s]+([\d,]+\.?\d*)/i,
    ]),
    tds_q1: extractAmount(rawText, [
      /Q1[:\s]+([\d,]+\.?\d*)/i,
      /(?:April|May|June)[^0-9]*([\d,]+\.?\d*)/i,
    ]),
    tds_q2: extractAmount(rawText, [
      /Q2[:\s]+([\d,]+\.?\d*)/i,
    ]),
    tds_q3: extractAmount(rawText, [
      /Q3[:\s]+([\d,]+\.?\d*)/i,
    ]),
    tds_q4: extractAmount(rawText, [
      /Q4[:\s]+([\d,]+\.?\d*)/i,
    ]),
    raw_text: rawText,
  };

  // Parse 80C sub-components
  const pf = extractAmount(rawText, [/Provident\s+Fund[:\s]+([\d,]+\.?\d*)/i]);
  const ppf = extractAmount(rawText, [/Public\s+Provident\s+Fund[:\s]+([\d,]+\.?\d*)/i]);
  const lic = extractAmount(rawText, [/LIC\s+(?:Premium)?[:\s]+([\d,]+\.?\d*)/i]);
  const elss = extractAmount(rawText, [/ELSS[:\s]+([\d,]+\.?\d*)/i]);
  const housingLoan = extractAmount(rawText, [
    /Housing\s+Loan\s+(?:Principal)?[:\s]+([\d,]+\.?\d*)/i,
  ]);
  if (pf) result.sec_80c_details["Provident Fund"] = pf;
  if (ppf) result.sec_80c_details["PPF"] = ppf;
  if (lic) result.sec_80c_details["LIC Premium"] = lic;
  if (elss) result.sec_80c_details["ELSS"] = elss;
  if (housingLoan) result.sec_80c_details["Housing Loan Principal"] = housingLoan;

  return result;
}

// ─── Form 26AS Parser ─────────────────────────────────────────────────────────

export async function parseForm26AS(buffer: Buffer, mimeType: string = "application/pdf"): Promise<ParsedForm26AS> {
  const rawText = await extractText(buffer, mimeType);

  const result: ParsedForm26AS = {
    pan: extractString(rawText, [
      /PAN[:\s]+([A-Z]{5}[0-9]{4}[A-Z])/i,
    ]),
    name: extractString(rawText, [
      /Name[:\s]+([^\n]+)/i,
    ]),
    assessment_year: extractString(rawText, [
      /Assessment\s+Year[:\s]+(\d{4}-\d{2,4})/i,
    ]),
    tds_entries: [],
    tcs_entries: [],
    advance_tax: 0,
    self_assessment_tax: 0,
    total_tds: 0,
    raw_text: rawText,
  };

  // Parse TDS entries from Part A
  const tdsBlockMatch = rawText.match(/PART\s+A[\s\S]*?(?=PART\s+B|$)/i);
  if (tdsBlockMatch) {
    const tdsBlock = tdsBlockMatch[0];
    // Pattern: TAN, Name, Section, Amount, TDS
    const tdsRowPattern =
      /([A-Z]{4}[0-9]{5}[A-Z])\s+([^\n]+)\s+(\d{3}[A-Z]?)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)/gi;
    let match: RegExpExecArray | null;
    while ((match = tdsRowPattern.exec(tdsBlock)) !== null) {
      const entry: TDSEntry = {
        deductor_tan: match[1],
        deductor_name: match[2].trim(),
        section: match[3],
        amount_paid: parseFloat(match[4].replace(/,/g, "")),
        tds_deducted: parseFloat(match[5].replace(/,/g, "")),
        tds_deposited: parseFloat(match[6].replace(/,/g, "")),
      };
      result.tds_entries.push(entry);
    }
  }

  // Compute total TDS
  result.total_tds = result.tds_entries.reduce(
    (sum, e) => sum + e.tds_deducted,
    0
  );

  // Parse advance tax (Part C)
  result.advance_tax = extractAmount(rawText, [
    /Advance\s+Tax[:\s]+([\d,]+\.?\d*)/i,
  ]);

  result.self_assessment_tax = extractAmount(rawText, [
    /Self\s+Assessment\s+Tax[:\s]+([\d,]+\.?\d*)/i,
  ]);

  return result;
}

// ─── AIS Parser ───────────────────────────────────────────────────────────────

export async function parseAIS(buffer: Buffer, mimeType: string = "application/pdf"): Promise<ParsedAIS> {
  const rawText = await extractText(buffer, mimeType);

  return {
    pan: extractString(rawText, [/PAN[:\s]+([A-Z]{5}[0-9]{4}[A-Z])/i]),
    assessment_year: extractString(rawText, [
      /Assessment\s+Year[:\s]+(\d{4}-\d{2,4})/i,
    ]),
    salary_reported: extractAmount(rawText, [
      /Salary[:\s]+([\d,]+\.?\d*)/i,
      /Income\s+from\s+Salary[:\s]+([\d,]+\.?\d*)/i,
    ]),
    interest_income: extractAmount(rawText, [
      /Interest\s+Income[:\s]+([\d,]+\.?\d*)/i,
      /Bank\s+Interest[:\s]+([\d,]+\.?\d*)/i,
    ]),
    dividend_income: extractAmount(rawText, [
      /Dividend[:\s]+([\d,]+\.?\d*)/i,
    ]),
    sale_of_securities: extractAmount(rawText, [
      /Sale\s+of\s+Securities[:\s]+([\d,]+\.?\d*)/i,
      /Securities\s+Transactions[:\s]+([\d,]+\.?\d*)/i,
    ]),
    sale_of_immovable_property: extractAmount(rawText, [
      /Sale\s+of\s+Immovable\s+Property[:\s]+([\d,]+\.?\d*)/i,
    ]),
    foreign_remittance: extractAmount(rawText, [
      /Foreign\s+Remittance[:\s]+([\d,]+\.?\d*)/i,
    ]),
    gst_turnover: extractAmount(rawText, [
      /GST\s+Turnover[:\s]+([\d,]+\.?\d*)/i,
    ]),
    rent_received: extractAmount(rawText, [
      /Rent\s+Received[:\s]+([\d,]+\.?\d*)/i,
    ]),
    raw_text: rawText,
  };
}

// ─── Salary Slip Parser ───────────────────────────────────────────────────────

export async function parseSalarySlip(
  buffer: Buffer,
  mimeType: string
): Promise<ParsedSalarySlip[]> {
  const rawText = await extractText(buffer, mimeType);

  const monthNames = [
    "JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE",
    "JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER",
  ];
  const monthMatch = rawText.toUpperCase().match(
    new RegExp(`(${monthNames.join("|")})`)
  );
  const monthStr = monthMatch ? monthMatch[1] : "";
  const yearMatch = rawText.match(/20\d{2}/);
  const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();

  const slip: ParsedSalarySlip = {
    month: monthStr,
    year,
    basic_salary: extractAmount(rawText, [
      /Basic\s+(?:Salary|Pay)[:\s]+([\d,]+\.?\d*)/i,
    ]),
    hra: extractAmount(rawText, [
      /H\.?R\.?A\.?[:\s]+([\d,]+\.?\d*)/i,
      /House\s+Rent\s+Allowance[:\s]+([\d,]+\.?\d*)/i,
    ]),
    special_allowance: extractAmount(rawText, [
      /Special\s+Allowance[:\s]+([\d,]+\.?\d*)/i,
    ]),
    conveyance_allowance: extractAmount(rawText, [
      /Conveyance[:\s]+([\d,]+\.?\d*)/i,
      /Transport\s+Allowance[:\s]+([\d,]+\.?\d*)/i,
    ]),
    medical_allowance: extractAmount(rawText, [
      /Medical\s+Allowance[:\s]+([\d,]+\.?\d*)/i,
    ]),
    lta: extractAmount(rawText, [
      /L\.?T\.?A\.?[:\s]+([\d,]+\.?\d*)/i,
      /Leave\s+Travel[:\s]+([\d,]+\.?\d*)/i,
    ]),
    bonus: extractAmount(rawText, [
      /Bonus[:\s]+([\d,]+\.?\d*)/i,
    ]),
    other_allowances: extractAmount(rawText, [
      /Other\s+Allowances[:\s]+([\d,]+\.?\d*)/i,
    ]),
    gross_salary: extractAmount(rawText, [
      /Gross\s+(?:Salary|Pay|Earnings)[:\s]+([\d,]+\.?\d*)/i,
      /Total\s+Earnings[:\s]+([\d,]+\.?\d*)/i,
    ]),
    professional_tax: extractAmount(rawText, [
      /Professional\s+Tax[:\s]+([\d,]+\.?\d*)/i,
      /P\.?Tax[:\s]+([\d,]+\.?\d*)/i,
    ]),
    pf_employee: extractAmount(rawText, [
      /Employee\s+P\.?F\.?[:\s]+([\d,]+\.?\d*)/i,
      /PF\s+Employee[:\s]+([\d,]+\.?\d*)/i,
      /Provident\s+Fund[:\s]+([\d,]+\.?\d*)/i,
    ]),
    esic: extractAmount(rawText, [
      /ESIC[:\s]+([\d,]+\.?\d*)/i,
      /ESI[:\s]+([\d,]+\.?\d*)/i,
    ]),
    tds: extractAmount(rawText, [
      /TDS[:\s]+([\d,]+\.?\d*)/i,
      /Income\s+Tax[:\s]+([\d,]+\.?\d*)/i,
    ]),
    other_deductions: extractAmount(rawText, [
      /Other\s+Deductions[:\s]+([\d,]+\.?\d*)/i,
    ]),
    net_salary: extractAmount(rawText, [
      /Net\s+(?:Salary|Pay|Take\s+Home)[:\s]+([\d,]+\.?\d*)/i,
      /Net\s+Amount\s+Payable[:\s]+([\d,]+\.?\d*)/i,
    ]),
  };

  return [slip];
}

// ─── Build IncomeData from Parsed Documents ───────────────────────────────────

export function buildIncomeData(
  parsedDocuments: ParsedDocument[],
  userAge: number = 30,
  userPan: string = ""
): IncomeData {
  const income = createDefaultIncomeData();
  income.age = userAge;
  income.pan = userPan;

  let form16: ParsedForm16 | null = null;
  let form26as: ParsedForm26AS | null = null;
  let ais: ParsedAIS | null = null;
  const salarySlips: ParsedSalarySlip[] = [];

  for (const doc of parsedDocuments) {
    switch (doc.type) {
      case "FORM16":
        form16 = doc.data;
        break;
      case "FORM26AS":
        form26as = doc.data;
        break;
      case "AIS":
        ais = doc.data;
        break;
      case "SALARY_SLIP":
        salarySlips.push(...doc.data);
        break;
    }
  }

  // Priority: Form 16 > Salary Slips > AIS
  if (form16) {
    income.gross_salary = form16.gross_salary || income.gross_salary;
    income.basic_salary = form16.basic_salary || income.basic_salary;
    income.hra_received = form16.hra_received || income.hra_received;
    income.lta_received = form16.lta_received || income.lta_received;
    income.bonus = form16.bonus || income.bonus;
    income.other_allowances = form16.other_allowances || income.other_allowances;
    income.sec_80c = form16.sec_80c_total || income.sec_80c;
    income.sec_80d_self = form16.sec_80d_self || income.sec_80d_self;
    income.sec_80d_parents = form16.sec_80d_parents || income.sec_80d_parents;
    income.nps_80ccd1b = form16.nps_80ccd1b || income.nps_80ccd1b;
    income.tds_employer = form16.tds_deducted || income.tds_employer;
  } else if (salarySlips.length > 0) {
    // Annualise from salary slips
    const totalGross = salarySlips.reduce((s, slip) => s + slip.gross_salary, 0);
    const totalBasic = salarySlips.reduce((s, slip) => s + slip.basic_salary, 0);
    const totalHra = salarySlips.reduce((s, slip) => s + slip.hra, 0);
    const totalTds = salarySlips.reduce((s, slip) => s + slip.tds, 0);

    // If fewer than 12 months, annualise
    const factor = salarySlips.length < 12 ? 12 / salarySlips.length : 1;
    income.gross_salary = Math.round(totalGross * factor);
    income.basic_salary = Math.round(totalBasic * factor);
    income.hra_received = Math.round(totalHra * factor);
    income.tds_employer = Math.round(totalTds * factor);
  }

  // Supplement with AIS data
  if (ais) {
    if (!income.gross_salary && ais.salary_reported) {
      income.gross_salary = ais.salary_reported;
    }
    if (!income.interest_income && ais.interest_income) {
      income.interest_income = ais.interest_income;
    }
    if (!income.rental_income && ais.rent_received) {
      income.rental_income = ais.rent_received;
    }
    if (!income.capital_gains_long && ais.sale_of_securities) {
      income.capital_gains_long = ais.sale_of_securities;
    }
  }

  // Supplement TDS from Form 26AS
  if (form26as) {
    if (!income.tds_employer && form26as.total_tds) {
      const salaryTds = form26as.tds_entries
        .filter((e) => e.section === "192" || e.section === "192A")
        .reduce((sum, e) => sum + e.tds_deducted, 0);
      const otherTds = form26as.tds_entries
        .filter((e) => e.section !== "192" && e.section !== "192A")
        .reduce((sum, e) => sum + e.tds_deducted, 0);

      income.tds_employer = salaryTds;
      income.tds_other = otherTds;
    }
    income.advance_tax = form26as.advance_tax + form26as.self_assessment_tax;
  }

  return income;
}
