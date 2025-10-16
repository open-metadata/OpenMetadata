import { Zap } from 'lucide-react';
import GlassCard from '../ui/GlassCard';
import './AutoSavesFeed.css';

const AutoSavesFeed = ({ feedData = {} }) => {
  const {
    status = 'Paused',
    savings = 'NA'
  } = feedData;

  return (
    <GlassCard className="auto-saves-feed" hover>
      <div className="auto-saves-feed__content">
        <h3 className="auto-saves-feed__title">
          <Zap className="auto-saves-feed__icon" />
          Automation
        </h3>
        
        <div className="auto-saves-feed__items">
          <div className="auto-saves-feed__item">
            <div className="auto-saves-feed__indicator" />
            <span className="auto-saves-feed__status">{status}</span>
          </div>
          
          <div className="auto-saves-feed__savings">
            {savings}
          </div>
        </div>
      </div>
    </GlassCard>
  );
};

export default AutoSavesFeed;
