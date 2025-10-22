'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  ArrowRight, Download, Play, Snowflake, Cloud, Workflow as WorkflowIcon, 
  Database, BarChart3, Clock, DollarSign, Shield, GitBranch,
  Zap, Eye, Target, TrendingUp, CheckCircle2, Calendar,
  Server, FileCode, Sparkles, Network, Box, ChevronRight, Star, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LandingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [showPlanPreview, setShowPlanPreview] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedToggles, setSelectedToggles] = useState<string[]>([]);
  const [prompt, setPrompt] = useState(
    "Create a weekly sales forecast for Baby products across India for the next 12 weeks. Use the last 18 months of data, include holiday effects, and segment by marketplace channel. Publish to a Tableau dashboard and a Snowflake table. Refresh daily at 06:00 IST after upstreams finish."
  );

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

  const handleGeneratePlan = () => {
    setShowPlanPreview(true);
    setTimeout(() => {
      document.getElementById('plan-preview')?.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      });
    }, 100);
  };

  const handleDownloadYAML = () => {
    const yamlContent = `# ZeroHuman AutoETL Plan Specification
# Generated for: Baby Product Sales Forecast

name: baby_products_sales_forecast_india
description: Weekly sales forecast for Baby products across India with holiday effects
version: 1.0.0

schedule:
  frequency: daily
  time: "06:00"
  timezone: Asia/Kolkata
  wait_for_upstream: true
  
data_sources:
  - name: sales_history
    type: snowflake
    connection: prod_snowflake
    query: |
      SELECT date, marketplace_channel, product_sku, quantity, revenue
      FROM sales.fact_transactions
      WHERE category = 'Baby' AND country = 'India'
      AND date >= DATEADD(month, -18, CURRENT_DATE())
    
  - name: holiday_calendar
    type: snowflake
    connection: prod_snowflake
    table: reference.india_holidays

transformations:
  - name: feature_engineering
    engine: dbt
    models:
      - baby_products_features
      - holiday_indicators
      - channel_aggregations
    
  - name: forecast_model
    engine: python
    runtime: databricks
    notebook: forecasting/baby_products_prophet.ipynb
    parameters:
      horizon_weeks: 12
      confidence_interval: 0.95
      include_holidays: true
      segment_by: marketplace_channel

outputs:
  - name: forecast_table
    type: snowflake
    connection: prod_snowflake
    table: analytics.baby_products_forecast
    mode: overwrite
    
  - name: tableau_dashboard
    type: tableau
    connection: prod_tableau
    project: Sales Analytics
    dashboard: Baby Products Forecast - India
    refresh_extract: true

governance:
  data_quality:
    - check: row_count
      min: 1000
      max: 1000000
    - check: mape
      threshold: 15
      
  cost_control:
    max_warehouse_credits: 5.0
    warehouse_size: MEDIUM
    auto_suspend_minutes: 5
    
  lineage:
    auto_track: true
    publish_to: openmetadata
    
  alerts:
    - type: failure
      channel: slack
      recipients: ["#data-eng-alerts"]
    - type: sla_breach
      channel: email
      recipients: ["data-team@company.com"]

backfill:
  enabled: false
  start_date: null
  
metadata:
  owner: data-analytics-team
  tags: [forecast, baby-products, india, sales]
  documentation: https://docs.company.com/forecasts/baby-products
  
estimated_cost:
  monthly_compute: $127
  monthly_storage: $23
  total: $150
`;

    const blob = new Blob([yamlContent], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'zerohuman-autoetl-plan.yaml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleOption = (option: string) => {
    setSelectedToggles(prev => 
      prev.includes(option) 
        ? prev.filter(o => o !== option)
        : [...prev, option]
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const connectors = [
    { name: "Snowflake", icon: Snowflake },
    { name: "dbt", icon: GitBranch },
    { name: "Airflow", icon: WorkflowIcon },
    { name: "IICS", icon: Cloud },
    { name: "Databricks", icon: Database },
    { name: "Tableau", icon: BarChart3 },
    { name: "Oracle", icon: Server },
    { name: "Postgres", icon: Database },
    { name: "MySQL", icon: Database }
  ];

  const features = [
    {
      icon: Network,
      title: "Zoomable Lineage",
      description: "Interactive end-to-end data lineage visualization across all platforms with drill-down capabilities."
    },
    {
      icon: Clock,
      title: "Auto-Scheduling",
      description: "Intelligent scheduling that waits for upstream dependencies and optimizes for cost and performance."
    },
    {
      icon: DollarSign,
      title: "Cost-Aware",
      description: "Real-time cost estimates and optimization suggestions for warehouse sizing and execution."
    },
    {
      icon: Shield,
      title: "Governance-as-Code",
      description: "Policy enforcement, data quality checks, and compliance rules embedded in pipeline definitions."
    },
    {
      icon: Sparkles,
      title: "Agentic Planning",
      description: "AI agents that understand your intent and generate complete, production-ready data pipelines."
    },
    {
      icon: TrendingUp,
      title: "Forecast Example",
      description: "Pre-built Baby products sales forecasting with holiday effects and channel segmentation."
    }
  ];

  const toggleOptions = [
    "Add stockouts",
    "Include price elasticity",
    "MAPE < 12%",
    "Backfill 90 days",
    "Estimate monthly cost"
  ];

  const planOverview = {
    dependencies: ["sales.fact_transactions", "reference.india_holidays", "dbt models", "Databricks notebook"],
    refreshTime: "Daily at 06:00 IST",
    estimatedCost: "$150/month",
    duration: "~45 minutes"
  };

  const lineageNodes = [
    { id: 1, label: "Sales Data", platform: "Snowflake", icon: Snowflake, color: "from-blue-400 to-cyan-400", x: 100, y: 80 },
    { id: 2, label: "Holiday Calendar", platform: "Snowflake", icon: Snowflake, color: "from-blue-400 to-cyan-400", x: 100, y: 200 },
    { id: 3, label: "Feature Engineering", platform: "dbt", icon: GitBranch, color: "from-orange-400 to-red-400", x: 350, y: 140 },
    { id: 4, label: "ML Forecast Model", platform: "Databricks", icon: Database, color: "from-red-500 to-orange-500", x: 600, y: 140 },
    { id: 5, label: "Forecast Table", platform: "Snowflake", icon: Snowflake, color: "from-blue-400 to-cyan-400", x: 850, y: 80 },
    { id: 6, label: "Dashboard", platform: "Tableau", icon: BarChart3, color: "from-sky-400 to-blue-500", x: 850, y: 200 }
  ];

  const testimonials = [
    {
      name: "Priya N.",
      title: "Lead Data Engineer",
      company: "Nimbus Retail",
      quote: "I simply described the output I wanted — AutoETL figured out the joins, lineage, and scheduling. It saved our team weeks of setup time.",
      headline: "It's like ChatGPT for data engineers.",
      avatar: "PN"
    },
    {
      name: "Alejandro R.",
      title: "Data Platform Manager",
      company: "Orbital Finance",
      quote: "We had dozens of disconnected ETL jobs. ZeroHuman made them visible, governed, and cost-optimized within days. The lineage map is stunning.",
      headline: "Governance-as-code finally feels real.",
      avatar: "AR"
    },
    {
      name: "Emily C.",
      title: "Analytics Director",
      company: "BloomKart",
      quote: "We used the Baby Products forecast demo as a base — now 12 of our categories run daily, automatically re-scheduled when upstreams delay.",
      headline: "Our forecasting pipeline just works now.",
      avatar: "EC"
    },
    {
      name: "Haruto M.",
      title: "Head of Data Engineering",
      company: "Kinetic Tech",
      quote: "With AutoETL, our team focuses on insights, not pipeline babysitting. The AI even suggests cost-saving warehouse sizes. It's brilliant.",
      headline: "DataOps turned autonomous.",
      avatar: "HM"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-white">
      {/* Header */}
      <header className="border-b border-blue-100 bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3">
            <div className="flex items-center">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-600 bg-clip-text text-transparent">
                ZeroHuman
              </h1>
            </div>
            <div className="flex items-center space-x-3">
              <Link href="/auth/signin">
                <Button variant="ghost" className="text-blue-700 hover:text-blue-900 hover:bg-blue-50">Sign In</Button>
              </Link>
              <Link href="/auth/signup">
                <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white">Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 lg:py-20 relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>
        
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 mb-4 leading-tight tracking-tight">
            Describe your goal → AutoETL plans,
            <span className="block mt-2 bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-600 bg-clip-text text-transparent">
              builds, schedules & monitors
            </span>
          </h1>
          <p className="text-base md:text-lg text-gray-600 mb-6 max-w-4xl mx-auto leading-relaxed">
            On your existing stack — <span className="font-semibold text-gray-800">Snowflake • dbt • Airflow • IICS • Databricks • Tableau • RDBMS</span>
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button 
              size="lg" 
              onClick={() => document.getElementById('prompt-composer')?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg shadow-blue-200/50 px-8"
            >
              <Play className="mr-2 h-5 w-5" />
              Try the Baby Forecast Plan
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              onClick={handleDownloadYAML}
              className="w-full sm:w-auto border-2 border-blue-600 text-blue-700 hover:bg-blue-50 px-8"
            >
              <Download className="mr-2 h-5 w-5" />
              Download Spec (YAML)
            </Button>
          </div>
        </div>
      </section>

      {/* Prompt Composer Section */}
      <section id="prompt-composer" className="py-14 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
              Describe Your Goal in Plain English
            </h2>
            <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Let AI agents plan your entire data pipeline — from sources to outputs, with governance built in.
            </p>
          </div>

          <Card className="border-2 border-blue-200 shadow-xl">
            <CardContent className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Your Goal</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm leading-relaxed"
                  placeholder="Describe what you want to build..."
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">Optional Enhancements</label>
                <div className="flex flex-wrap gap-2">
                  {toggleOptions.map((option) => (
                    <button
                      key={option}
                      onClick={() => toggleOption(option)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        selectedToggles.includes(option)
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {selectedToggles.includes(option) && <CheckCircle2 className="inline-block w-4 h-4 mr-1" />}
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <Button 
                onClick={handleGeneratePlan}
                size="lg"
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg"
              >
                <Sparkles className="mr-2 h-5 w-5" />
                Generate Plan
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Plan Preview Section */}
      {showPlanPreview && (
        <section id="plan-preview" className="py-14 bg-gradient-to-br from-slate-50 to-blue-50/30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
                Your AI-Generated Plan
              </h2>
              <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
                Complete with lineage, schedule, cost estimates, and governance policies
              </p>
            </div>

            <Card className="border-2 border-blue-200 shadow-2xl">
              <CardHeader className="border-b border-gray-200">
                <div className="flex flex-wrap gap-2 justify-center">
                  {['overview', 'lineage', 'schedule', 'cost', 'governance'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-6 py-2 rounded-lg font-semibold text-sm transition-all capitalize ${
                        activeTab === tab
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="p-8">
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="font-bold text-lg mb-3 flex items-center">
                          <Database className="w-5 h-5 mr-2 text-blue-600" />
                          Dependencies
                        </h3>
                        <ul className="space-y-2">
                          {planOverview.dependencies.map((dep, i) => (
                            <li key={i} className="flex items-start">
                              <ChevronRight className="w-4 h-4 mt-1 mr-2 text-blue-600 flex-shrink-0" />
                              <span className="text-sm text-gray-700">{dep}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <h3 className="font-bold text-lg mb-2 flex items-center">
                            <Clock className="w-5 h-5 mr-2 text-blue-600" />
                            Schedule
                          </h3>
                          <p className="text-sm text-gray-700">{planOverview.refreshTime}</p>
                        </div>
                        <div>
                          <h3 className="font-bold text-lg mb-2 flex items-center">
                            <DollarSign className="w-5 h-5 mr-2 text-blue-600" />
                            Estimated Cost
                          </h3>
                          <p className="text-sm text-gray-700">{planOverview.estimatedCost}</p>
                        </div>
                        <div>
                          <h3 className="font-bold text-lg mb-2 flex items-center">
                            <Target className="w-5 h-5 mr-2 text-blue-600" />
                            Duration
                          </h3>
                          <p className="text-sm text-gray-700">{planOverview.duration}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'lineage' && (
                  <div className="space-y-4">
                    <h3 className="font-bold text-lg mb-4 text-center">End-to-End Data Lineage</h3>
                    <p className="text-sm text-gray-600 text-center mb-6">
                      Interactive flow showing data movement across platforms
                    </p>
                    <div className="relative bg-gradient-to-br from-slate-50 to-blue-50 p-8 rounded-lg border border-blue-200 overflow-x-auto">
                      <svg className="w-full min-w-[1000px]" height="320" viewBox="0 0 1050 320">
                        <defs>
                          {/* Arrow markers with different colors */}
                          <marker id="arrowBlue" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                            <polygon points="0 0, 10 3, 0 6" fill="#3b82f6" />
                          </marker>
                          <marker id="arrowOrange" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                            <polygon points="0 0, 10 3, 0 6" fill="#f97316" />
                          </marker>
                          <marker id="arrowRed" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                            <polygon points="0 0, 10 3, 0 6" fill="#ef4444" />
                          </marker>
                          
                          {/* Gradient definitions */}
                          <linearGradient id="gradSnowflake" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#60a5fa" />
                            <stop offset="100%" stopColor="#22d3ee" />
                          </linearGradient>
                          <linearGradient id="gradDbt" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#fb923c" />
                            <stop offset="100%" stopColor="#f87171" />
                          </linearGradient>
                          <linearGradient id="gradDatabricks" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#ef4444" />
                            <stop offset="100%" stopColor="#fb923c" />
                          </linearGradient>
                          <linearGradient id="gradTableau" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#38bdf8" />
                            <stop offset="100%" stopColor="#3b82f6" />
                          </linearGradient>
                        </defs>
                        
                        {/* Connection Lines */}
                        {/* From Sales Data to Feature Engineering */}
                        <path d="M 220 110 L 310 160" stroke="#3b82f6" strokeWidth="2.5" fill="none" markerEnd="url(#arrowBlue)" opacity="0.7" />
                        
                        {/* From Holiday Calendar to Feature Engineering */}
                        <path d="M 220 230 L 310 190" stroke="#3b82f6" strokeWidth="2.5" fill="none" markerEnd="url(#arrowBlue)" opacity="0.7" />
                        
                        {/* From Feature Engineering to ML Model */}
                        <path d="M 490 175 L 560 175" stroke="#f97316" strokeWidth="2.5" fill="none" markerEnd="url(#arrowOrange)" opacity="0.7" />
                        
                        {/* From ML Model to Forecast Table */}
                        <path d="M 740 155 L 810 120" stroke="#ef4444" strokeWidth="2.5" fill="none" markerEnd="url(#arrowRed)" opacity="0.7" />
                        
                        {/* From ML Model to Dashboard */}
                        <path d="M 740 195 L 810 220" stroke="#ef4444" strokeWidth="2.5" fill="none" markerEnd="url(#arrowRed)" opacity="0.7" />
                        
                        {/* Nodes */}
                        {lineageNodes.map((node) => {
                          const NodeIcon = node.icon;
                          const gradientId = 
                            node.platform === "Snowflake" ? "gradSnowflake" :
                            node.platform === "dbt" ? "gradDbt" :
                            node.platform === "Databricks" ? "gradDatabricks" :
                            "gradTableau";
                          
                          return (
                            <g key={node.id} className="hover:opacity-90 transition-opacity cursor-pointer">
                              {/* Card background */}
                              <rect
                                x={node.x}
                                y={node.y}
                                width="120"
                                height="80"
                                rx="12"
                                fill="white"
                                stroke="#e5e7eb"
                                strokeWidth="2"
                                filter="drop-shadow(0 4px 6px rgba(0,0,0,0.1))"
                              />
                              
                              {/* Icon circle */}
                              <circle
                                cx={node.x + 60}
                                cy={node.y + 28}
                                r="16"
                                fill={`url(#${gradientId})`}
                              />
                              
                              {/* Icon - represented as circle (since we can't render React components in SVG) */}
                              <circle
                                cx={node.x + 60}
                                cy={node.y + 28}
                                r="8"
                                fill="white"
                                opacity="0.9"
                              />
                              
                              {/* Label */}
                              <text
                                x={node.x + 60}
                                y={node.y + 58}
                                textAnchor="middle"
                                fill="#1f2937"
                                fontSize="11"
                                fontWeight="600"
                              >
                                {node.label}
                              </text>
                              
                              {/* Platform tag */}
                              <text
                                x={node.x + 60}
                                y={node.y + 72}
                                textAnchor="middle"
                                fill="#6b7280"
                                fontSize="9"
                                fontWeight="500"
                              >
                                {node.platform}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                    
                    {/* Legend */}
                    <div className="flex flex-wrap gap-4 justify-center mt-6 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center">
                          <Snowflake className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-gray-700 font-medium">Snowflake</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-400 flex items-center justify-center">
                          <GitBranch className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-gray-700 font-medium">dbt</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                          <Database className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-gray-700 font-medium">Databricks</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center">
                          <BarChart3 className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-gray-700 font-medium">Tableau</span>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'schedule' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-bold text-lg mb-3 flex items-center">
                        <Calendar className="w-5 h-5 mr-2 text-blue-600" />
                        Schedule Details
                      </h3>
                      <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700">Frequency:</span>
                          <span className="text-sm text-gray-900">Daily</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700">Time:</span>
                          <span className="text-sm text-gray-900">06:00 IST</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700">Wait for Upstreams:</span>
                          <span className="text-sm text-green-600 font-semibold">Yes ✓</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700">Safe Start Window:</span>
                          <span className="text-sm text-gray-900">After sales ETL completes</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-3">Backfill Configuration</h3>
                      <div className="bg-slate-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-700">
                          {selectedToggles.includes('Backfill 90 days') 
                            ? 'Backfill enabled for last 90 days' 
                            : 'No backfill configured'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'cost' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-bold text-lg mb-3 flex items-center">
                        <DollarSign className="w-5 h-5 mr-2 text-blue-600" />
                        Cost Breakdown
                      </h3>
                      <div className="bg-slate-50 p-6 rounded-lg space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700">Compute (Databricks + Snowflake):</span>
                          <span className="text-sm text-gray-900 font-semibold">$127/month</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700">Storage:</span>
                          <span className="text-sm text-gray-900 font-semibold">$23/month</span>
                        </div>
                        <div className="border-t border-gray-300 pt-3 flex justify-between items-center">
                          <span className="text-base font-bold text-gray-900">Total Estimated:</span>
                          <span className="text-lg font-bold text-blue-600">$150/month</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-3">Warehouse Size Optimizer</h3>
                      <div className="bg-slate-50 p-4 rounded-lg">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Select Warehouse Size:</label>
                        <select className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm">
                          <option>SMALL ($70/mo) - 60 min runtime</option>
                          <option selected>MEDIUM ($127/mo) - 45 min runtime</option>
                          <option>LARGE ($240/mo) - 30 min runtime</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'governance' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-bold text-lg mb-3 flex items-center">
                        <Shield className="w-5 h-5 mr-2 text-blue-600" />
                        Governance Policies
                      </h3>
                      <ul className="space-y-2 mb-4">
                        <li className="flex items-start">
                          <CheckCircle2 className="w-5 h-5 mt-0.5 mr-2 text-green-600 flex-shrink-0" />
                          <span className="text-sm text-gray-700">Data quality: Row count validation (1K-1M rows)</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle2 className="w-5 h-5 mt-0.5 mr-2 text-green-600 flex-shrink-0" />
                          <span className="text-sm text-gray-700">Forecast accuracy: MAPE threshold &lt; 15%</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle2 className="w-5 h-5 mt-0.5 mr-2 text-green-600 flex-shrink-0" />
                          <span className="text-sm text-gray-700">Auto-lineage tracking to OpenMetadata</span>
                        </li>
                        <li className="flex items-start">
                          <CheckCircle2 className="w-5 h-5 mt-0.5 mr-2 text-green-600 flex-shrink-0" />
                          <span className="text-sm text-gray-700">SLA monitoring with Slack alerts</span>
                        </li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-3">YAML Specification</h3>
                      <div className="bg-slate-900 p-4 rounded-lg overflow-auto max-h-64">
                        <pre className="text-xs text-green-400 font-mono">
{`governance:
  data_quality:
    - check: row_count
      min: 1000
      max: 1000000
    - check: mape
      threshold: 15
  cost_control:
    max_warehouse_credits: 5.0
    warehouse_size: MEDIUM
  lineage:
    auto_track: true
    publish_to: openmetadata
  alerts:
    - type: failure
      channel: slack`}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* Connectors Section */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-center text-sm font-semibold text-gray-500 mb-6 uppercase tracking-wide">
            Works with your existing stack
          </h3>
          <div className="flex flex-wrap justify-center items-center gap-8 opacity-60 hover:opacity-100 transition-opacity">
            {connectors.map((connector, index) => {
              const Icon = connector.icon;
              return (
                <div key={index} className="flex flex-col items-center gap-2 hover:scale-110 transition-transform cursor-pointer">
                  <Icon className="h-8 w-8 text-gray-600" />
                  <span className="text-xs font-medium text-gray-600">{connector.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Feature Highlights Section */}
      <section className="py-14 bg-gradient-to-br from-slate-50 to-blue-50/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
              Next-Gen AutoETL Features
            </h2>
            <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
              AI + Observability + Governance as Code
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="hover:shadow-xl transition-all border-blue-100 hover:border-blue-300 hover:-translate-y-1">
                <CardHeader>
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-xl flex items-center justify-center mb-3 shadow-sm">
                    <feature.icon className="h-6 w-6 text-blue-600" />
                  </div>
                  <CardTitle className="text-lg text-gray-900">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews Section */}
      <section id="reviews" className="py-16 bg-gradient-to-br from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
              Loved by data teams worldwide 🌍
            </h2>
            <p className="text-base md:text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
              From startups to enterprises, ZeroHuman AutoETL empowers engineers, analysts, and business teams to move from manual pipelines to intelligent automation.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="h-full hover:shadow-2xl transition-all border-slate-200 hover:border-blue-300 rounded-3xl overflow-hidden">
                  <CardContent className="p-8">
                    {/* Rating Stars */}
                    <div className="flex gap-1 mb-4">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>

                    {/* Headline Quote */}
                    <h3 className="text-xl font-bold text-gray-900 mb-3 leading-tight">
                      &quot;{testimonial.headline}&quot;
                    </h3>

                    {/* Full Quote */}
                    <p className="text-gray-700 mb-6 leading-relaxed">
                      &quot;{testimonial.quote}&quot;
                    </p>

                    {/* Author Info */}
                    <div className="flex items-center gap-4">
                      {/* Avatar Circle */}
                      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
                        {testimonial.avatar}
                      </div>
                      
                      {/* Name & Title */}
                      <div>
                        <p className="font-semibold text-gray-900">{testimonial.name}</p>
                        <p className="text-sm text-gray-600">
                          {testimonial.title} @ {testimonial.company}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-br from-blue-600 to-cyan-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
            Ready for Next-Gen AutoETL?
          </h2>
          <p className="text-lg text-blue-100 mb-8 leading-relaxed">
            Experience AI-driven planning, intelligent scheduling, and governance-as-code on your existing data stack.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={() => document.getElementById('prompt-composer')?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full sm:w-auto bg-white text-blue-600 hover:bg-blue-50 shadow-xl px-8"
            >
              <Play className="mr-2 h-5 w-5" />
              Try the Demo
            </Button>
            <Link href="/auth/signup">
              <Button 
                size="lg" 
                className="w-full sm:w-auto bg-transparent border-2 border-white text-white hover:bg-white hover:text-blue-600 transition-all px-8"
              >
                Talk to Us
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-blue-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-600 bg-clip-text text-transparent">
                ZeroHuman
              </h1>
            </div>
            <div className="flex items-center gap-8 text-sm text-gray-600">
              <Link href="#prompt-composer" className="hover:text-blue-600 transition-colors font-medium">Demo</Link>
              <Link href="/auth/signup" className="hover:text-blue-600 transition-colors font-medium">Product</Link>
              <button onClick={handleDownloadYAML} className="hover:text-blue-600 transition-colors font-medium">Spec</button>
              <Link href="/auth/signin" className="hover:text-blue-600 transition-colors font-medium">Contact</Link>
            </div>
            <p className="text-sm text-gray-500">
              © {new Date().getFullYear()} ZeroHuman. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

