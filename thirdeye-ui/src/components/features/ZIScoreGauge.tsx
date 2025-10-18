'use client';

import { HelpCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ZIScoreGaugeProps {
  score?: number;
  breakdown?: {
    compute?: number;
    storage?: number;
    query?: number;
    others?: number;
  };
  onLearnMore?: () => void;
  className?: string;
}

export default function ZIScoreGauge({ 
  score = 74, 
  breakdown = {}, 
  onLearnMore,
  className 
}: ZIScoreGaugeProps) {
  // Calculate percentage for radial gauge
  const percentage = score;
  const strokeDasharray = 2 * Math.PI * 80; // radius = 80
  const strokeDashoffset = strokeDasharray - (strokeDasharray * percentage) / 100;

  const breakdownData = [
    { label: 'Storage', value: breakdown.storage || 0, color: 'bg-purple-500' },
    { label: 'Compute', value: breakdown.compute || 0, color: 'bg-cyan-500' },
    { label: 'Query', value: breakdown.query || 0, color: 'bg-blue-500' },
    { label: 'Others', value: breakdown.others || 0, color: 'bg-indigo-500' }
  ];

  // Determine score color based on value
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-cyan-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStrokeColor = (score: number) => {
    if (score >= 80) return 'stroke-green-500';
    if (score >= 60) return 'stroke-cyan-500';
    if (score >= 40) return 'stroke-yellow-500';
    return 'stroke-red-500';
  };

  return (
    <Card className={cn('p-6 hover:shadow-lg transition-shadow', className)}>
      <div className="space-y-4">
        {/* Gauge Chart */}
        <div className="flex items-center justify-center">
          <div className="relative">
            <svg className="w-48 h-48 transform -rotate-90">
              {/* Background Circle */}
              <circle
                cx="96"
                cy="96"
                r="80"
                className="fill-none stroke-muted stroke-[12]"
                style={{ strokeOpacity: 0.1 }}
              />
              
              {/* Progress Circle with Gradient */}
              <defs>
                <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#7c3aed" />
                  <stop offset="25%" stopColor="#0891b2" />
                  <stop offset="50%" stopColor="#06b6d4" />
                  <stop offset="75%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
              </defs>
              
              <circle
                cx="96"
                cy="96"
                r="80"
                className={cn('fill-none stroke-[12] transition-all duration-1000', getStrokeColor(score))}
                style={{
                  strokeDasharray,
                  strokeDashoffset,
                  strokeLinecap: 'round',
                  stroke: 'url(#scoreGradient)'
                }}
              />
            </svg>
            
            {/* Score Display */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className={cn('text-5xl font-bold', getScoreColor(score))}>
                  {score}
                </div>
                <div className="text-sm text-muted-foreground font-medium mt-1">
                  ZeroIndex
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-2 gap-3">
          {breakdownData.map((metric) => (
            <div key={metric.label} className="flex items-center gap-2">
              <div className={cn('w-2 h-2 rounded-full', metric.color)} />
              <span className="text-sm text-muted-foreground">
                {metric.label}: <span className="font-medium text-foreground">{metric.value}%</span>
              </span>
            </div>
          ))}
        </div>

        {/* Learn More */}
        <div className="pt-2 border-t">
          <button
            onClick={onLearnMore}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <HelpCircle className="h-4 w-4" />
            <span>Why {score}? ZeroExplain →</span>
          </button>
        </div>
      </div>
    </Card>
  );
}

