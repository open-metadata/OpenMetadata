import React, { useState } from 'react';
import { ProfileSettings } from './profile';
import { SecuritySettings } from './security';
import { AccountsSettings } from './accounts';
import DeleteAccount from './delete';

type SettingsTab = 'profile' | 'security' | 'accounts' | 'delete';

function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  const tabs = [
    { id: 'profile' as SettingsTab, label: 'Profile', icon: '👤' },
    { id: 'security' as SettingsTab, label: 'Security', icon: '🔒' },
    { id: 'accounts' as SettingsTab, label: 'Accounts', icon: '🔗' },
    { id: 'delete' as SettingsTab, label: 'Delete Account', icon: '🗑️', danger: true }
  ];

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileSettings />;
      case 'security':
        return <SecuritySettings />;
      case 'accounts':
        return <AccountsSettings />;
      case 'delete':
        return <DeleteAccount />;
      default:
        return <ProfileSettings />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      {/* Header */}
      <div className="bg-gray-900/50 backdrop-blur-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-gray-400 mt-1">Manage your account preferences and security</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:w-64 flex-shrink-0">
            <nav className="space-y-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    tab.danger
                      ? activeTab === tab.id
                        ? 'bg-red-600 text-white'
                        : 'text-red-400 hover:bg-red-900/20 hover:text-red-300'
                      : activeTab === tab.id
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-800/50 hover:text-white'
                  }`}
                >
                  <span className="text-lg">{tab.icon}</span>
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {renderActiveTab()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
