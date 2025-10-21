'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowRight, Database, Zap, Shield, Network, Eye, 
  Workflow, Sparkles, TrendingUp, CheckCircle2, GitBranch,
  Activity, Link as LinkIcon, Gauge, Brain, ServerCog
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LandingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          router.push('/dashboard/thirdeye');
          return;
        }
      } catch (error) {
        // User is not authenticated, show landing page
      }
      setIsLoading(false);
    };

    checkAuth();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const problems = [
    {
      icon: Database,
      title: "Every platform is a silo",
      description: "Tools like Snowflake, Spark, and Airflow operate brilliantly in isolation but poorly together."
    },
    {
      icon: Workflow,
      title: "Human-driven ETL doesn't scale",
      description: "Every change triggers code, coordination, and chaos."
    },
    {
      icon: Shield,
      title: "Governance comes last",
      description: "Lineage, SLAs, and policies are bolted on, not built in."
    },
    {
      icon: Brain,
      title: "AI needs context, not tables",
      description: "LLMs and agents can't reason over disconnected datasets."
    }
  ];

  const components = [
    {
      name: "ZeroLink",
      function: "Cross-platform data discovery and semantic mapping (Databricks ↔ Snowflake ↔ Oracle ↔ Airflow)",
      poweredBy: "AI Mapping Engine",
      icon: LinkIcon
    },
    {
      name: "ZeroAutoETL",
      function: "Autonomous pipeline generation, monitoring, and healing",
      poweredBy: "Agentic Orchestration",
      icon: Zap
    },
    {
      name: "ZeroPulse",
      function: "Continuous health, drift, and lineage analytics",
      poweredBy: "Observability Intelligence",
      icon: Activity
    },
    {
      name: "ZeroGovern",
      function: "Policy, SLA, and compliance enforcement in motion",
      poweredBy: "Rule-Based Reasoning",
      icon: Shield
    },
    {
      name: "ZeroSense",
      function: "Root cause + impact correlation engine",
      poweredBy: "Causal AI",
      icon: Eye
    },
    {
      name: "ZeroSync",
      function: "Cross-domain contract synchronization and update propagation",
      poweredBy: "Cognitive Sync Layer",
      icon: GitBranch
    }
  ];

  const steps = [
    {
      number: "1",
      title: "Connect",
      description: "ZeroHuman connects directly to Snowflake, Databricks, Oracle, Airflow, Spark, and APIs — using your existing credentials, roles, and schemas. It builds a live semantic index of all data assets, jobs, and pipelines."
    },
    {
      number: "2",
      title: "Learn",
      description: "AI agents analyze schema, lineage, and usage to infer domain meaning, data contracts, and dependencies. They identify redundant or broken paths, unused data, and opportunities for consolidation."
    },
    {
      number: "3",
      title: "Automate",
      description: "AutoETL Agents generate, repair, and optimize pipelines automatically — applying templates, governance rules, and data quality tests with zero code."
    },
    {
      number: "4",
      title: "Govern & Observe",
      description: "Continuous checks for drift, SLA breaches, failures, and cost anomalies. All insights flow into dashboards, APIs, or Slack for real-time action."
    },
    {
      number: "5",
      title: "Act & Improve",
      description: "ZeroHuman Agents act — fixing issues, enforcing access policies, and tuning performance. Every action teaches the system, making the mesh smarter every day."
    }
  ];

  const benefits = [
    {
      icon: Network,
      title: "Integrates seamlessly",
      description: "Works with Snowflake, Databricks, Airflow, Spark, Oracle, PostgreSQL, MySQL, BigQuery, etc."
    },
    {
      icon: ServerCog,
      title: "No re-platforming",
      description: "AI runs alongside existing tools, learning and adapting."
    },
    {
      icon: Zap,
      title: "AutoETL Agents",
      description: "Handle ingestion, transformation, and optimization dynamically."
    },
    {
      icon: Shield,
      title: "Governance built-in",
      description: "Lineage, access, and compliance enforced in runtime."
    },
    {
      icon: Eye,
      title: "Observability + Intelligence",
      description: "Insights across jobs, data, and usage patterns."
    }
  ];

  const kpis = [
    { value: "80%", label: "Fewer manual pipeline interventions" },
    { value: "50×", label: "Faster time-to-insight with AutoETL Agents" },
    { value: "90%", label: "Lineage coverage across all systems" },
    { value: "99.9%", label: "SLA reliability via autonomous enforcement" }
  ];

  const testimonials = [
    {
      quote: "ZeroHuman didn't replace Databricks or Snowflake — it made them intelligent collaborators.",
      author: "Head of Data Engineering",
      company: "Fortune 100 Retail"
    },
    {
      quote: "We now discover and govern 10× more datasets without new infra — AutoETL just works.",
      author: "Director, Data Governance",
      company: "FinTech"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-white">
      {/* Header */}
      <header className="border-b border-indigo-100 bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3">
            <div className="flex items-center">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-500 to-cyan-500 bg-clip-text text-transparent">
                ZeroHuman
              </h1>
            </div>
            <div className="flex items-center space-x-3">
              <Link href="/auth/signin">
                <Button variant="ghost" className="text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50">Sign In</Button>
              </Link>
              <Link href="/auth/signup">
                <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white">Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 lg:py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-cyan-500/5 pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 mb-5 leading-tight tracking-tight">
            Activate Intelligence
            <span className="block mt-2">Across Your Data Stack</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-700 mb-8 max-w-3xl mx-auto leading-relaxed font-medium">
            ZeroHuman unifies data from Databricks, Snowflake, Airflow, Spark, Oracle, and beyond — building a <span className="text-indigo-600 font-semibold">decentralized AI Data Mesh</span> powered by <span className="text-purple-600 font-semibold">AutoETL Agents</span>.
            <span className="block mt-2">It doesn't replace your tools; it makes them work <em>together intelligently</em>.</span>
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/auth/signup">
              <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-xl shadow-indigo-200 px-8">
                Get a ZeroHuman Demo
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/auth/signin">
              <Button variant="outline" size="lg" className="w-full sm:w-auto border-2 border-indigo-600 text-indigo-700 hover:bg-indigo-50 px-8">
                See AutoETL in Action
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-14 bg-gradient-to-br from-slate-50 to-indigo-50/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
              The Modern Data Problem
            </h2>
            <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Your tools are powerful, but they don't work together — creating silos, manual work, and blind spots.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {problems.map((problem, index) => (
              <Card key={index} className="hover:shadow-xl transition-all border-slate-200 hover:border-red-200 hover:-translate-y-1">
                <CardHeader>
                  <div className="w-12 h-12 bg-gradient-to-br from-red-100 to-orange-100 rounded-xl flex items-center justify-center mb-3 shadow-sm">
                    <problem.icon className="h-6 w-6 text-red-600" />
                  </div>
                  <CardTitle className="text-lg text-gray-900">{problem.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 leading-relaxed">{problem.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
              The ZeroHuman Way — AI-Native Data Mesh
            </h2>
            <p className="text-base md:text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
              A decentralized, intelligent data fabric that learns your ecosystem.
              ZeroHuman <span className="text-indigo-600 font-semibold">connects, observes, and optimizes</span> your existing data tools automatically.
              Each dataset, job, and model becomes an <span className="text-purple-600 font-semibold">intelligent data product</span> — complete with contracts, lineage, SLAs, and semantics.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {components.map((component, index) => (
              <Card key={index} className="hover:shadow-xl transition-all border-indigo-100 hover:border-purple-200 hover:-translate-y-1">
                <CardHeader>
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl flex items-center justify-center mb-3 shadow-sm">
                    <component.icon className="h-6 w-6 text-indigo-600" />
                  </div>
                  <CardTitle className="text-xl text-gray-900">{component.name}</CardTitle>
                  <CardDescription className="text-sm text-gray-600 mt-2">{component.function}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium">
                    <Sparkles className="w-3 h-3 mr-1" />
                    {component.poweredBy}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-14 bg-gradient-to-br from-slate-50 to-indigo-50/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
              How It Works
            </h2>
            <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Five steps to intelligent, autonomous data infrastructure
            </p>
          </div>

          <div className="space-y-6">
            {steps.map((step, index) => (
              <div key={index} className="flex gap-4 items-start p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border border-indigo-100">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
                  {step.number}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
              Why It Fits Your Existing Stack
            </h2>
            <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
              ZeroHuman works with what you have, making it smarter
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((benefit, index) => (
              <Card key={index} className="hover:shadow-xl transition-all border-slate-200 hover:border-indigo-200 hover:-translate-y-1">
                <CardHeader>
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-cyan-100 rounded-xl flex items-center justify-center mb-3 shadow-sm">
                    <benefit.icon className="h-6 w-6 text-indigo-600" />
                  </div>
                  <CardTitle className="text-lg text-gray-900">{benefit.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 leading-relaxed">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* KPIs Section */}
      <section className="py-14 bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-3 tracking-tight">
              Impact KPIs
            </h2>
            <p className="text-base md:text-lg text-indigo-100 max-w-2xl mx-auto leading-relaxed">
              Real results from organizations using ZeroHuman
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {kpis.map((kpi, index) => (
              <div key={index} className="text-center p-6 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 hover:bg-white/20 transition-all">
                <div className="text-4xl md:text-5xl font-bold mb-2">{kpi.value}</div>
                <div className="text-sm text-indigo-100">{kpi.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
              What Our Customers Say
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="hover:shadow-xl transition-all border-indigo-100">
                <CardContent className="pt-6">
                  <p className="text-lg text-gray-700 italic mb-4 leading-relaxed">
                    &quot;{testimonial.quote}&quot;
                  </p>
                  <div className="text-sm">
                    <p className="font-semibold text-gray-900">{testimonial.author}</p>
                    <p className="text-gray-600">{testimonial.company}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-br from-slate-50 to-indigo-50/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 tracking-tight">
            Ready to make your data stack think?
          </h2>
          <p className="text-lg text-gray-600 mb-8 leading-relaxed">
            Experience AI-driven AutoETL, policy intelligence, and decentralized data mesh — without changing your tools.
          </p>
          <Link href="/auth/signup">
            <Button size="lg" className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-xl shadow-indigo-200 px-8">
              Get a ZeroHuman Demo
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-indigo-100 bg-gradient-to-br from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-500 to-cyan-500 bg-clip-text text-transparent">
                ZeroHuman
              </h1>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-600">
              <Link href="#" className="hover:text-indigo-600 transition-colors">Try ZeroHuman Sandbox</Link>
              <Link href="#" className="hover:text-indigo-600 transition-colors">ZeroAgent Platform</Link>
            </div>
            <p className="text-sm text-gray-500">
              © 2024 ZeroHuman. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

