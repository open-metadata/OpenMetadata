import React from 'react';
import { Bell, User } from 'lucide-react';
import './TopBar.css';

const TopBar = ({ title = "" }) => {
  return (
    <div className="topbar">
      <div className="topbar__content">
        <div className="topbar__title">
          <span className="topbar__title-text gradient-text">
            {title}
          </span>
        </div>

        <div className="topbar__actions">
          {/* Notification Bell */}
          <div className="topbar__notification">
            <div className="topbar__notification-icon">
              <Bell className="topbar__icon" />
            </div>
            <div className="topbar__notification-badge" />
          </div>

          {/* User Icon */}
          <div className="topbar__user">
            <User className="topbar__icon" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopBar;
