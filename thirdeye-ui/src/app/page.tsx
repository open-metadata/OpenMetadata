'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { 
  ArrowRight, BarChart3, Search, Bot, Shield, Database, Zap, 
  Clock, Layers, ShieldAlert, Network, Eye, Lock, 
  Workflow, Sparkles, TrendingUp, CheckCircle2, Users, Building2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LandingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already authenticated
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          // User is authenticated, redirect to dashboard
          router.push('/dashboard');
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

  const challenges = [
    {
      icon: Clock,
      title: "Too slow for real agents",
      description: "Hand-offs and tool sprawl starve agents of the real-time context they need."
    },
    {
      icon: Layers,
      title: "Human-first stacks",
      description: "Schema/storage–centric designs lack domain semantics and a single endpoint for agents."
    },
    {
      icon: ShieldAlert,
      title: "Trust gaps at scale",
      description: "Without lineage, policy, and runtime guardrails, mistakes scale at machine speed."
    }
  ];

  const solutions = [
    {
      icon: Database,
      title: "Create ZeroAgent Data Products",
      description: "Standardize ingestion-to-access as agent-ready products—self-governing, multimodal, and discoverable across any stack.",
      link: "Learn more"
    },
    {
      icon: Workflow,
      title: "Accelerate with ZeroRunbook",
      description: "Copilot-generate interconnected products from what you already have—safe for ZeroRAG, ZeroMCP, and multi-agent systems.",
      link: "Learn more"
    },
    {
      icon: Network,
      title: "Operate on ZeroAgent Runtime",
      description: "Run, observe, and secure agents and products everywhere with the ZeroAgent Mesh and unified policy control.",
      link: "Learn more"
    }
  ];

  const dataProductFeatures = [
    {
      icon: Bot,
      title: "Serve agents (and humans) from one endpoint",
      description: "Domain-semantic, multimodal access for tools, apps, and LLM agents."
    },
    {
      icon: Shield,
      title: "Sense & act with ZeroGuard",
      description: "Detect source/policy changes and orchestrate quality, access, and remediation automatically."
    },
    {
      icon: Network,
      title: "Work everywhere with ZeroAgent Mesh",
      description: "One standard across stacks, formats, and use cases."
    },
    {
      icon: Eye,
      title: "Data + code + quality + control",
      description: "Full lifecycle encapsulated; observable with ZeroWatch."
    },
    {
      icon: Sparkles,
      title: "Reuse your estate",
      description: "Bootstrap from current tables, models, and code—no re-platforming."
    },
    {
      icon: TrendingUp,
      title: "Shorten the data supply chain",
      description: "Fewer brittle layers; more direct outcomes for agents."
    }
  ];

  const kpis = [
    { value: "50×", label: "faster", description: "Time to first agent-ready product" },
    { value: "24/7", label: "control", description: "Continuous policy + runtime guardrails with ZeroGuard" },
    { value: "< 1 hour", label: "", description: "Onboard a domain to ZeroAgent Runtime" }
  ];

  const testimonials = [
    {
      icon: Building2,
      quote: "ZeroAgent Platform shifted us from tool integration to outcome ownership—without a replatform.",
      author: "Global Head of Data Platforms",
      company: "F500 CPG"
    },
    {
      icon: Users,
      quote: "ZeroAgent Mesh unified our stacks and cut agent time-to-value drastically.",
      author: "VP, AI & Platform Eng",
      company: "Global Retail"
    },
    {
      icon: Lock,
      quote: "Governed agent access accelerated research while preserving compliance.",
      author: "Exec Director, Predictive Systems",
      company: "Life Sciences"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-white">
      {/* Header */}
      <header className="border-b border-indigo-100 bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3">
            <div className="flex items-center">
              <Image
                src="/logo.png"
                alt="ZeroHuman"
                width={140}
                height={36}
                className="h-9 w-auto"
              />
            </div>
            <div className="flex items-center space-x-3">
              <Link href="/auth/signin">
                <Button variant="ghost" className="text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50">Sign In</Button>
              </Link>
              <Link href="/auth/signup">
                <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-200">
                  Get Started
                </Button>
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
            Bridge the action gap
            <span className="block mt-2">for AI agents</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-700 mb-8 max-w-3xl mx-auto leading-relaxed font-medium">
            ZeroHuman packages your data and logic into <span className="text-indigo-600 font-semibold">ZeroAgent Data Products</span> that agents can query, 
            reason over, and act on—securely and autonomously.
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
                Explore ZeroAgent Platform
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Challenges Section - Legacy isn't ready for agents */}
      <section className="py-14 bg-gradient-to-br from-slate-50 to-indigo-50/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
              Legacy isn&apos;t ready for agents
            </h2>
            <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Traditional data infrastructure creates barriers that prevent AI agents from reaching their full potential.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {challenges.map((challenge, index) => (
              <Card key={index} className="hover:shadow-xl transition-all border-slate-200 hover:border-red-200 hover:-translate-y-1">
                <CardHeader>
                  <div className="w-12 h-12 bg-gradient-to-br from-red-100 to-orange-100 rounded-xl flex items-center justify-center mb-3 shadow-sm">
                    <challenge.icon className="h-6 w-6 text-red-600" />
                  </div>
                  <CardTitle className="text-lg font-bold text-gray-900 leading-snug">{challenge.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm text-gray-600 leading-relaxed">
                    {challenge.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Solution Band */}
      <section className="py-14 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-3 tracking-tight">
            Built for human teams—and AI agents
          </h2>
          <p className="text-base md:text-lg mb-7 opacity-95 leading-relaxed max-w-3xl mx-auto">
            <span className="font-semibold">ZeroAgent Platform</span> turns data + code into governed ZeroAgent Data Products with one endpoint for agents, 
            apps, and analytics—observable, policy-aware, and instantly usable.
          </p>
          <Link href="/auth/signup">
            <Button size="lg" variant="secondary" className="bg-white text-indigo-700 hover:bg-gray-100 shadow-xl px-8">
              Get a ZeroHuman Demo
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* How We Do It Section */}
      <section className="py-14 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
              How we do it
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {solutions.map((solution, index) => (
              <Card key={index} className="hover:shadow-xl transition-all border-indigo-100 hover:border-indigo-300 hover:-translate-y-1 bg-gradient-to-br from-white to-indigo-50/30">
                <CardHeader>
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center mb-3 shadow-lg shadow-indigo-200">
                    <solution.icon className="h-7 w-7 text-white" />
                  </div>
                  <CardTitle className="text-lg font-bold text-gray-900 leading-snug">{solution.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm text-gray-600 leading-relaxed mb-4">
                    {solution.description}
                  </CardDescription>
                  <Link href="#" className="text-indigo-600 hover:text-indigo-700 font-semibold text-sm inline-flex items-center gap-1">
                    {solution.link} <ArrowRight className="h-4 w-4" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Data Products Section */}
      <section className="py-14 bg-gradient-to-br from-indigo-50/50 via-purple-50/30 to-cyan-50/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
              ZeroAgent Data Products are <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">different</span>
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {dataProductFeatures.map((feature, index) => (
              <Card key={index} className="hover:shadow-xl transition-all border-indigo-100 hover:border-indigo-200 hover:-translate-y-0.5 bg-white/80 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                      <feature.icon className="h-5 w-5 text-indigo-600" />
                    </div>
                    <CardTitle className="text-base font-bold text-gray-900 leading-snug">{feature.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pl-16">
                  <CardDescription className="text-sm text-gray-600 leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* KPI Section */}
      <section className="py-14 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-3 tracking-tight">
              Change the game for agents
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {kpis.map((kpi, index) => (
              <div key={index} className="text-center bg-white/10 backdrop-blur-sm rounded-2xl p-6 hover:bg-white/15 transition-all">
                <div className="text-5xl md:text-6xl font-extrabold mb-2 tracking-tight">
                  {kpi.value}
                </div>
                {kpi.label && (
                  <div className="text-xl md:text-2xl font-semibold mb-2 tracking-wide">
                    {kpi.label}
                  </div>
                )}
                <div className="text-sm md:text-base opacity-95 leading-relaxed">
                  {kpi.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-14 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="hover:shadow-xl transition-all border-indigo-100 hover:border-indigo-200 bg-gradient-to-br from-white to-indigo-50/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center">
                      <testimonial.icon className="h-5 w-5 text-indigo-600" />
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-green-500 ml-auto" />
                  </div>
                  <p className="text-sm italic mb-5 text-gray-700 leading-relaxed">&quot;{testimonial.quote}&quot;</p>
                  <div className="text-xs border-t border-gray-100 pt-4">
                    <div className="font-bold text-gray-900">{testimonial.author}</div>
                    <div className="text-gray-500 mt-1">{testimonial.company}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-16 bg-gradient-to-br from-indigo-50 via-purple-50/30 to-cyan-50 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 pointer-events-none"></div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight leading-tight">
            Ready to activate agents with <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">real autonomy?</span>
          </h2>
          <p className="text-base md:text-lg text-gray-600 mb-8 leading-relaxed max-w-2xl mx-auto">
            Transform your data infrastructure into agent-ready products that drive autonomous outcomes.
          </p>
          <Link href="/auth/signup">
            <Button size="lg" className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-xl shadow-indigo-200 px-10">
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
              <Image
                src="/logo.png"
                alt="ZeroHuman"
                width={120}
                height={32}
                className="h-8 w-auto"
              />
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