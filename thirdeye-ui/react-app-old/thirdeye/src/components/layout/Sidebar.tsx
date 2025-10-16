import React from 'react';
import { Bot, Lightbulb, Shield, HelpCircle, Settings, LogOut, Sparkles, Home } from 'lucide-react';
import './Sidebar.css';

interface SidebarProps {
  onLogout: () => void;
  onNavigate: (page: 'dashboard' | 'techniques' | 'help' | 'insights' | 'settings') => void;
  currentPage: 'dashboard' | 'techniques' | 'help' | 'insights' | 'settings';
}

const Sidebar: React.FC<SidebarProps> = ({ onLogout, onNavigate, currentPage }) => {
  const handleHomeClick = () => {
    // Navigate to dashboard and scroll to top
    onNavigate('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTechniquesClick = () => {
    // Navigate to techniques showcase page
    onNavigate('techniques');
  };

  const handleHelpClick = () => {
    // Navigate to help page
    onNavigate('help');
  };

  const handleInsightsClick = () => {
    // Navigate to insights page
    onNavigate('insights');
  };

  const handleSettingsClick = () => {
    // Navigate to settings page
    onNavigate('settings');
  };

  const handleLogoutClick = () => {
    onLogout();
  };

  const mainMenuItems = [
    { 
      icon: Home, 
      label: 'Home', 
      active: currentPage === 'dashboard', 
      onClick: handleHomeClick 
    },
    { icon: Bot, label: 'AI Assistant', active: false },
    { 
      icon: Lightbulb, 
      label: 'Insights', 
      active: currentPage === 'insights', 
      onClick: handleInsightsClick 
    },
    { 
      icon: Shield, 
      label: 'Techniques', 
      active: currentPage === 'techniques', 
      onClick: handleTechniquesClick 
    }
  ];

  const bottomMenuItems = [
    { 
      icon: HelpCircle, 
      label: 'Help', 
      active: currentPage === 'help', 
      onClick: handleHelpClick 
    },
    { 
      icon: Settings, 
      label: 'Settings', 
      active: currentPage === 'settings', 
      onClick: handleSettingsClick 
    },
    { icon: LogOut, label: 'Logout', onClick: handleLogoutClick }
  ];

  const MenuItem = ({ icon: Icon, label, active = false, onClick }) => (
    <div 
      className={`sidebar-menu-item ${active ? 'sidebar-menu-item--active' : ''}`}
      onClick={onClick}
      title={label}
    >
      <Icon className="sidebar-menu-item__icon" />
    </div>
  );

  return (
    <div className="sidebar">
      <div className="sidebar__content">
        {/* Brand Icon */}
        <div className="sidebar__brand">
          <div className="sidebar__brand-icon">
            <div className="sidebar__brand-shape" />
            <Sparkles className="sidebar__brand-sparkles" />
          </div>
        </div>

        {/* Main Menu Items */}
        <div className="sidebar__main-menu">
          {mainMenuItems.map((item, index) => (
            <MenuItem
              key={index}
              icon={item.icon}
              label={item.label}
              active={item.active}
              onClick={item.onClick}
            />
          ))}
        </div>
      </div>

      {/* Bottom Menu Items */}
      <div className="sidebar__bottom-menu">
        {bottomMenuItems.map((item, index) => (
          <MenuItem
            key={index}
            icon={item.icon}
            label={item.label}
            active={item.active}
            onClick={item.onClick}
          />
        ))}
      </div>
    </div>
  );
};

export default Sidebar;
