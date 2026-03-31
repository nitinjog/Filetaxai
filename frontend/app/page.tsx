import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  FileText,
  IndianRupee,
  Lock,
  ShieldCheck,
  Sparkles,
  Upload,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-navy-900/95 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-saffron-500">
              <IndianRupee className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-bold text-white">
              FileTax<span className="text-saffron-400">AI</span>
            </span>
          </div>
          <div className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-sm text-slate-300 hover:text-white transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-sm text-slate-300 hover:text-white transition-colors">
              How it Works
            </a>
            <a href="#security" className="text-sm text-slate-300 hover:text-white transition-colors">
              Security
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-white/10">
                Log In
              </Button>
            </Link>
            <Link href="/register">
              <Button variant="saffron" size="sm">
                Get Started Free
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="gradient-hero pt-16">
        <div className="container mx-auto px-4 py-24 text-center">
          <Badge className="mb-6 bg-saffron-500/20 text-saffron-300 border-saffron-500/30 text-sm px-4 py-1">
            <Sparkles className="mr-1 h-3 w-3" />
            AY 2024-25 | AI-Powered ITR Filing
          </Badge>

          <h1 className="mx-auto max-w-4xl text-5xl font-bold leading-tight text-white md:text-6xl lg:text-7xl">
            File Your ITR in{' '}
            <span className="text-gradient">Minutes,</span>
            <br />
            Not Hours
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300 md:text-xl">
            Upload your Form 16, let our AI parse it instantly, compare Old vs New Regime,
            and get a CA-grade computation — all in one place.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/register">
              <Button variant="saffron" size="xl" className="gap-2 shadow-lg shadow-saffron-500/25">
                Start Filing Free
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="#how-it-works">
              <Button
                variant="outline"
                size="xl"
                className="gap-2 border-white/20 text-white bg-white/5 hover:bg-white/10"
              >
                See How It Works
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="mx-auto mt-16 grid max-w-2xl grid-cols-3 gap-8 border-t border-white/10 pt-10">
            {[
              { value: '10,000+', label: 'Returns Filed' },
              { value: '₹2.4 Cr+', label: 'Tax Saved' },
              { value: '99.8%', label: 'Accuracy Rate' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold text-white">{stat.value}</div>
                <div className="mt-1 text-sm text-slate-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Hero visual */}
        <div className="relative overflow-hidden pb-0">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-4xl rounded-t-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
              <div className="mb-4 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-400" />
                <div className="h-3 w-3 rounded-full bg-yellow-400" />
                <div className="h-3 w-3 rounded-full bg-green-400" />
                <span className="ml-2 text-xs text-slate-400">FileTaxAI Dashboard</span>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                  { label: 'Gross Income', value: '₹12,00,000', color: 'text-blue-400' },
                  { label: 'Total Deductions', value: '₹2,10,000', color: 'text-green-400' },
                  { label: 'Taxable Income', value: '₹9,90,000', color: 'text-yellow-400' },
                  { label: 'Tax Payable', value: '₹1,17,000', color: 'text-saffron-400' },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-white/5 p-4">
                    <div className="text-xs text-slate-400">{item.label}</div>
                    <div className={`mt-1 text-xl font-bold ${item.color}`}>{item.value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-lg bg-green-500/10 border border-green-500/20 p-3">
                <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
                <span className="text-sm text-green-300">
                  <strong>New Regime recommended</strong> — Save ₹18,200 compared to Old Regime
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-slate-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">Features</Badge>
            <h2 className="text-4xl font-bold text-slate-900">
              Everything You Need to File with Confidence
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Built for salaried Indians. No CA needed.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className={`mb-4 inline-flex rounded-lg p-3 ${feature.iconBg}`}>
                  <feature.icon className={`h-6 w-6 ${feature.iconColor}`} />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <Badge className="mb-4 bg-saffron-50 text-saffron-700 border-saffron-200">
              Simple Process
            </Badge>
            <h2 className="text-4xl font-bold text-slate-900">File in 3 Simple Steps</h2>
            <p className="mt-4 text-lg text-slate-600">
              No complicated forms. No confusing jargon.
            </p>
          </div>

          <div className="mx-auto max-w-4xl">
            <div className="grid gap-8 md:grid-cols-3">
              {steps.map((step, idx) => (
                <div key={step.title} className="relative text-center">
                  {idx < steps.length - 1 && (
                    <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-px bg-gradient-to-r from-slate-300 to-slate-100" />
                  )}
                  <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-navy-700 text-white shadow-lg">
                    <step.icon className="h-8 w-8" />
                    <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-saffron-500 text-xs font-bold text-white">
                      {idx + 1}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Security / Trust */}
      <section id="security" className="py-24 bg-navy-700">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-white/10 text-white border-white/20">Security First</Badge>
            <h2 className="text-4xl font-bold text-white">Your Data is Safe with Us</h2>
            <p className="mt-4 text-slate-300">
              Bank-level security for your most sensitive financial documents.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {trustIndicators.map((item) => (
              <div
                key={item.title}
                className="rounded-xl glass-card p-6 text-center"
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-saffron-500/20">
                  <item.icon className="h-6 w-6 text-saffron-400" />
                </div>
                <h3 className="font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-saffron-500 to-saffron-600">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-white">
            Ready to File Your ITR?
          </h2>
          <p className="mt-4 text-lg text-saffron-100">
            Join 10,000+ Indians who filed smarter with FileTaxAI.
            <br />
            Free to start. No credit card required.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/register">
              <Button
                size="xl"
                className="gap-2 bg-white text-saffron-600 hover:bg-saffron-50 shadow-lg"
              >
                Get Started Free
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button
                variant="outline"
                size="xl"
                className="gap-2 border-white/40 text-white hover:bg-white/10"
              >
                Already have an account? Log In
              </Button>
            </Link>
          </div>
          <p className="mt-6 text-sm text-saffron-200">
            ✓ Free computation &nbsp;&nbsp; ✓ Old vs New Regime comparison &nbsp;&nbsp; ✓ Step-by-step filing guide
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy-900 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-saffron-500">
                <IndianRupee className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="font-bold text-white">
                FileTax<span className="text-saffron-400">AI</span>
              </span>
            </div>
            <p className="text-sm text-slate-500">
              © 2025 FileTaxAI. For informational purposes. Consult a CA for complex tax matters.
            </p>
            <div className="flex gap-4 text-sm text-slate-500">
              <a href="#" className="hover:text-slate-300 transition-colors">Privacy</a>
              <a href="#" className="hover:text-slate-300 transition-colors">Terms</a>
              <a href="#" className="hover:text-slate-300 transition-colors">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const features = [
  {
    icon: Bot,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    title: 'AI Document Parsing',
    description:
      'Upload Form 16, Form 26AS, or AIS. Our AI extracts all income and TDS data automatically — no manual entry needed.',
  },
  {
    icon: IndianRupee,
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600',
    title: 'Old vs New Regime Comparison',
    description:
      'Instant side-by-side comparison of both tax regimes with clear savings breakdown. Know which regime saves you more money.',
  },
  {
    icon: Zap,
    iconBg: 'bg-yellow-50',
    iconColor: 'text-yellow-600',
    title: 'Instant Computation',
    description:
      'CA-grade tax computation with all slabs, surcharges, and cess calculated accurately for AY 2024-25.',
  },
  {
    icon: Sparkles,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    title: 'AI Tax Suggestions',
    description:
      'Our AI identifies deductions you might have missed — 80C, 80D, HRA, home loan interest, and more.',
  },
  {
    icon: FileText,
    iconBg: 'bg-saffron-50',
    iconColor: 'text-saffron-600',
    title: 'ITR Filing Guide',
    description:
      'Step-by-step guide to file on the Income Tax portal. Know exactly which ITR form to use and what to fill.',
  },
  {
    icon: Lock,
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
    title: 'Bank-Level Security',
    description:
      'Your documents are encrypted with AES-256. We never store your PAN or Aadhaar without your consent.',
  },
];

const steps = [
  {
    icon: Upload,
    title: 'Upload Documents',
    description:
      'Drag and drop your Form 16, Form 26AS, or AIS. Our AI parses them in seconds.',
  },
  {
    icon: Zap,
    title: 'Compute Tax',
    description:
      'Review auto-filled income details, add any missing deductions, and hit Compute.',
  },
  {
    icon: FileText,
    title: 'File Your ITR',
    description:
      'Get your pre-filled data summary and follow our step-by-step guide to file on the official portal.',
  },
];

const trustIndicators = [
  {
    icon: ShieldCheck,
    title: 'AES-256 Encrypted',
    description: 'All documents and data encrypted at rest and in transit.',
  },
  {
    icon: Lock,
    title: 'No Data Sharing',
    description: 'We never sell or share your financial data with third parties.',
  },
  {
    icon: CheckCircle2,
    title: 'CA-Grade Accuracy',
    description: 'Tax calculations verified against official IT department rules.',
  },
  {
    icon: FileText,
    title: 'GDPR Compliant',
    description: 'Request deletion of all your data at any time.',
  },
];
