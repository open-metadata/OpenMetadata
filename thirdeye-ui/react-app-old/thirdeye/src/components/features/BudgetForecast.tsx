import { BarChart3, TrendingUp } from 'lucide-react';
import GlassCard from '../ui/GlassCard';
import './BudgetForecast.css';

const BudgetForecast = ({ budgetData = {} }) => {
  const {
    total_monthly_cost_usd = 300000,
    monthly_savings_opportunity_usd = 28000,
    roi = 15.2
  } = budgetData;

  // Calculate forecasted cost after savings
  const forecastedCost = total_monthly_cost_usd - monthly_savings_opportunity_usd;
  const savingsPercentage = ((monthly_savings_opportunity_usd / total_monthly_cost_usd) * 100).toFixed(1);
  const costReductionPercentage = ((forecastedCost / total_monthly_cost_usd) * 100).toFixed(0);

  const formatCurrency = (amount) => {
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}k`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <GlassCard className="budget-forecast" hover>
      <div className="budget-forecast__content">
        <h3 className="budget-forecast__title">
          <BarChart3 className="budget-forecast__icon" />
          Budget & Forecast
        </h3>
        
        {/* Top Row: Total Cost and ROI */}
        <div className="budget-forecast__top-row">
          <div className="budget-forecast__key-metric">
            <div className="budget-forecast__key-metric-content">
              <span className="budget-forecast__key-metric-label">Total Cost</span>
              <span className="budget-forecast__key-metric-value">{formatCurrency(total_monthly_cost_usd)}</span>
            </div>
          </div>
          
          <div className="budget-forecast__key-metric budget-forecast__key-metric--roi">
            <div className="budget-forecast__key-metric-content">
              <span className="budget-forecast__key-metric-label">ROI</span>
              {/*<span className="budget-forecast__key-metric-value">{roi}%</span>*/}
                <span className="budget-forecast__key-metric-value">NA</span>
            </div>
          </div>
        </div>

        {/* Second Row: Cost Optimization Bar */}
        <div className="budget-forecast__bottom-row">
          <div className="budget-forecast__optimization">
            <div className="budget-forecast__optimization-header">
              <span className="budget-forecast__optimization-title">
                <TrendingUp size={14} style={{ marginRight: '4px', color: '#0891b2' }} />
                Forecast
              </span>
              <span className="budget-forecast__optimization-savings">
                Save {formatCurrency(monthly_savings_opportunity_usd)} ({savingsPercentage}%)
              </span>
            </div>
            
            <div className="budget-forecast__optimization-bars">
              {/* Single Optimization Bar */}
              <div className="budget-forecast__bar-container">
                <div className="budget-forecast__progress budget-forecast__progress--single">
                  <div 
                    className="budget-forecast__progress-bar budget-forecast__progress-bar--optimized"
                    style={{ width: `${costReductionPercentage}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
};

export default BudgetForecast;
