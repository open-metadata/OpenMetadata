import { cn } from '@/lib/utils';

interface KpiCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
  className?: string;
}

export default function KpiCard({ 
  title, 
  value, 
  change, 
  icon, 
  className 
}: KpiCardProps) {
  return (
    <div className={cn(
      'rounded-lg border bg-card p-6 shadow-sm',
      className
    )}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          {change && (
            <p className={cn(
              'text-sm',
              change.isPositive ? 'text-green-600' : 'text-red-600'
            )}>
              {change.isPositive ? '+' : ''}{change.value}%
            </p>
          )}
        </div>
        {icon && (
          <div className="h-8 w-8 text-muted-foreground">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
