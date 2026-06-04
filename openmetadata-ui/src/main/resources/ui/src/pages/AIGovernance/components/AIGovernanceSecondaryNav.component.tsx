/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import {
  ComponentType,
  CSSProperties,
  ReactNode,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PLACEHOLDER_ROUTE_TAB, ROUTES } from '../../../constants/constants';
import { AIGovernanceTab } from '../AIGovernancePage.interface';
import {
  IcAlertTri,
  IcArrL,
  IcArrR,
  IcCheckCirc,
  IcCpu,
  IcFile,
  IcFlag,
  IcGrid,
  IcPlus,
  IcScale,
  IcShieldTick,
} from '../icons/AIGovIcons';

type AIGovNavIcon = ComponentType<{
  className?: string;
  style?: CSSProperties;
}>;

interface AIGovernanceSecondaryNavProps {
  activeTab: AIGovernanceTab;
  registryCount?: number;
  shadowCount?: number;
  approvalsCount?: number;
  onOpenIntake: () => void;
}

interface AIAssetsNavItem {
  key: AIGovernanceTab;
  labelKey: string;
  icon: AIGovNavIcon;
  badge?: number;
  badgeTone?: 'default' | 'error' | 'warning';
}

const renderIcon = (Icon: AIGovNavIcon) => (
  <span className="ai-gov-secondary-nav-item-icon-slot">
    <Icon className="ai-gov-secondary-nav-item-icon" />
  </span>
);

interface AIAssetsNavRowProps {
  active: boolean;
  badge?: number;
  badgeTone?: 'default' | 'error' | 'warning';
  collapsed: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  testId: string;
}

const AIAssetsNavRow = ({
  active,
  badge,
  badgeTone = 'default',
  collapsed,
  icon,
  label,
  onClick,
  testId,
}: AIAssetsNavRowProps) => (
  <button
    className={`ai-gov-secondary-nav-item is-ai-child ${
      active ? 'is-active' : ''
    }`}
    data-testid={testId}
    title={collapsed ? label : undefined}
    type="button"
    onClick={onClick}>
    {icon}
    {!collapsed && (
      <span className="ai-gov-secondary-nav-item-content">
        <span className="ai-gov-secondary-nav-item-label">{label}</span>
        {typeof badge === 'number' && (
          <span
            className={`ai-gov-secondary-nav-badge ai-gov-secondary-nav-badge--${badgeTone}`}>
            {badge}
          </span>
        )}
      </span>
    )}
    {collapsed && typeof badge === 'number' && (
      <span
        className={`ai-gov-secondary-nav-dot ai-gov-secondary-nav-dot--${badgeTone}`}
      />
    )}
  </button>
);

const AIGovernanceSecondaryNav = ({
  activeTab,
  approvalsCount,
  onOpenIntake,
  registryCount,
  shadowCount,
}: AIGovernanceSecondaryNavProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const aiItems = useMemo<AIAssetsNavItem[]>(
    () => [
      {
        key: AIGovernanceTab.OVERVIEW,
        labelKey: 'label.overview',
        icon: IcShieldTick,
      },
      {
        key: AIGovernanceTab.REGISTRY,
        labelKey: 'label.ai-asset-registry',
        icon: IcGrid,
        badge: registryCount,
      },
      {
        key: AIGovernanceTab.SHADOW,
        labelKey: 'label.shadow-ai',
        icon: IcAlertTri,
        badge: shadowCount,
        badgeTone: 'error',
      },
      {
        key: AIGovernanceTab.APPROVALS,
        labelKey: 'label.approval-plural',
        icon: IcCheckCirc,
        badge: approvalsCount,
        badgeTone: 'warning',
      },
      {
        key: AIGovernanceTab.FRAMEWORKS,
        labelKey: 'label.framework-plural',
        icon: IcScale,
      },
      {
        key: AIGovernanceTab.POLICIES,
        labelKey: 'label.policies-and-drift',
        icon: IcFlag,
      },
      {
        key: AIGovernanceTab.REPORTS,
        labelKey: 'label.audit-report-plural',
        icon: IcFile,
      },
    ],
    [approvalsCount, registryCount, shadowCount]
  );

  const handleAIItemClick = (key: AIGovernanceTab) => {
    navigate(ROUTES.AI_GOVERNANCE_WITH_TAB.replace(PLACEHOLDER_ROUTE_TAB, key));
  };

  return (
    <aside
      className={`ai-gov-secondary-nav ${
        collapsed ? 'ai-gov-secondary-nav--collapsed' : ''
      }`}
      data-testid="ai-gov-secondary-nav">
      <div className="ai-gov-secondary-nav-header">
        {!collapsed && (
          <div className="ai-gov-secondary-nav-section-title">
            <IcCpu className="ai-gov-secondary-nav-section-icon" />
            <div className="ai-gov-secondary-nav-section-copy">
              <span>{t('label.ai-governance')}</span>
              <span className="ai-gov-secondary-nav-new">{t('label.new')}</span>
            </div>
          </div>
        )}
        <button
          aria-label={collapsed ? t('label.expand') : t('label.collapse')}
          className="ai-gov-secondary-nav-toggle"
          type="button"
          onClick={() => setCollapsed((value) => !value)}>
          {collapsed ? <IcArrR /> : <IcArrL />}
        </button>
      </div>

      <nav aria-label={t('label.ai-governance')}>
        <div className="ai-gov-secondary-nav-ai-section">
          <div className="ai-gov-secondary-nav-ai-list">
            {aiItems.map((item) => (
              <AIAssetsNavRow
                active={item.key === activeTab}
                badge={item.badge}
                badgeTone={item.badgeTone}
                collapsed={collapsed}
                icon={renderIcon(item.icon)}
                key={item.key}
                label={t(item.labelKey)}
                testId={`ai-gov-secondary-nav-${item.key}`}
                onClick={() => handleAIItemClick(item.key)}
              />
            ))}
          </div>
        </div>
      </nav>

      <div className="ai-gov-secondary-nav-spacer" />

      <button
        className="ai-gov-secondary-nav-register"
        data-testid="ai-gov-secondary-nav-register"
        title={collapsed ? t('label.register-ai-asset') : undefined}
        type="button"
        onClick={onOpenIntake}>
        <IcPlus className="ai-gov-secondary-nav-register-icon" />
        {!collapsed && <span>{t('label.register-ai-asset')}</span>}
      </button>
    </aside>
  );
};

export default AIGovernanceSecondaryNav;
