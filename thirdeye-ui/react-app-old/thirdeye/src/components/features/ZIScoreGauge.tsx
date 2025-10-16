import { RadialBarChart, RadialBar, ResponsiveContainer} from 'recharts';
import GlassCard from '../ui/GlassCard';
import './ZIScoreGauge.css';

const ZIScoreGauge = ({ score = 74, breakdown = {}, onNavigate }) => {
  // Create data with background and current value
  const gaugeData = [
    {
      name: 'Background',
      value: 100,
      fill: 'rgba(255,255,255,0.05)'
    },
    {
      name: 'Current Score',
      value: score,
      fill: '#1f84d5'
    }
  ];


  const breakdownData = [
      { label: 'Storage', value: breakdown.storage || 0 },
    { label: 'Compute', value: breakdown.compute || 0 },
    { label: 'Query', value: breakdown.query || 0 },
    { label: 'Others', value: breakdown.others || 0 }
  ];

  return (
    <GlassCard className="zi-score-gauge" hover>
      <div className="zi-score-gauge__content">
        {/* Gauge Chart */}
        <div className="zi-score-gauge__chart">
          <div className="zi-score-gauge__chart-container">
            <ResponsiveContainer>
              <RadialBarChart
                cx="50%"
                cy="90%"
                innerRadius={127}
                outerRadius={187}
                startAngle={180}
                endAngle={0}
                data={gaugeData}
              >
                <defs>
                  <linearGradient id="liquidFill" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#7c3aed" />
                    <stop offset="25%" stopColor="#0891b2" />
                    <stop offset="50%" stopColor="#06b6d4" />
                    <stop offset="75%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
                <RadialBar
                  dataKey="value"
                  cornerRadius={10}
                  fill="url(#liquidFill)"
                  background={{ fill: 'rgba(255,255,255,0.05)' }}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            
            {/* Score Display */}
            <div className="zi-score-gauge__score">
              <div className="zi-score-gauge__score-value">{score}</div>
              <div className="zi-score-gauge__score-label">ZI Score</div>
            </div>
          </div>
        </div>

        {/* Breakdown */}
        <div className="zi-score-gauge__breakdown">
          <div className="zi-score-gauge__breakdown-grid">
            {breakdownData.map((metric, index) => (
              <div key={metric.label} className="zi-score-gauge__breakdown-item">
                <span className="zi-score-gauge__breakdown-text">
                  {metric.label}: <span className="zi-score-gauge__breakdown-value">{metric.value}%</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Learn More */}
        <div className="zi-score-gauge__footer">
          <span className="zi-score-gauge__footer-question">Why {score}? </span>
          <span 
            className="zi-score-gauge__footer-link cursor-pointer hover:text-cyan-300 transition-colors duration-200"
            onClick={() => onNavigate && onNavigate('help')}
          >
            Learn more →
          </span>
        </div>
      </div>
    </GlassCard>
  );
};

export default ZIScoreGauge;
