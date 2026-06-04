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

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import { PLACEHOLDER_ROUTE_TAB, ROUTES } from '../../constants/constants';
import { withPageLayout } from '../../hoc/withPageLayout';
import {
  EstateStats,
  getAIGovernanceDashboard,
} from '../../rest/aiGovernanceAPI';
import './ai-governance-page.less';
import { AIGovernanceTab } from './AIGovernancePage.interface';
import AIGovernanceSecondaryNav from './components/AIGovernanceSecondaryNav.component';
import IntakeWizard from './IntakeWizard/IntakeWizard.component';
import ApprovalsSection from './sections/Approvals/ApprovalsSection.component';
import AuditReportsSection from './sections/AuditReports/AuditReportsSection.component';
import FrameworksSection from './sections/Frameworks/FrameworksSection.component';
import OverviewSection from './sections/Overview/OverviewSection.component';
import PoliciesSection from './sections/Policies/PoliciesSection.component';
import RegistrySection from './sections/Registry/RegistrySection.component';
import ShadowSection from './sections/Shadow/ShadowSection.component';

interface AIGovernancePageProps {
  pageTitle: string;
}

const SECTION_TITLES: Record<AIGovernanceTab, string> = {
  [AIGovernanceTab.OVERVIEW]: 'label.ai-governance',
  [AIGovernanceTab.REGISTRY]: 'label.ai-asset-registry',
  [AIGovernanceTab.SHADOW]: 'label.shadow-ai',
  [AIGovernanceTab.APPROVALS]: 'label.approval-plural',
  [AIGovernanceTab.FRAMEWORKS]: 'label.framework-plural',
  [AIGovernanceTab.POLICIES]: 'label.policy-plural',
  [AIGovernanceTab.REPORTS]: 'label.audit-report-plural',
};

const SECTION_DESCRIPTIONS: Record<AIGovernanceTab, string> = {
  [AIGovernanceTab.OVERVIEW]: 'message.ai-governance-page-description',
  [AIGovernanceTab.REGISTRY]: 'message.ai-governance-page-description',
  [AIGovernanceTab.SHADOW]: 'message.shadow-ai-banner-description',
  [AIGovernanceTab.APPROVALS]: 'message.ai-governance-page-description',
  [AIGovernanceTab.FRAMEWORKS]: 'message.frameworks-section-description',
  [AIGovernanceTab.POLICIES]: 'message.ai-governance-page-description',
  [AIGovernanceTab.REPORTS]: 'message.ai-governance-page-description',
};

const AIGovernancePage = ({ pageTitle: _pageTitle }: AIGovernancePageProps) => {
  const { t } = useTranslation();
  const { tab } = useParams<{ tab?: string }>();
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [registryRefreshKey, setRegistryRefreshKey] = useState(0);
  const [navStats, setNavStats] = useState<EstateStats>();

  const validTabs = Object.values(AIGovernanceTab) as string[];
  const isInvalidTab = Boolean(tab && !validTabs.includes(tab));
  const activeTab = isInvalidTab
    ? AIGovernanceTab.OVERVIEW
    : (tab as AIGovernanceTab) ?? AIGovernanceTab.OVERVIEW;

  useEffect(() => {
    if (isInvalidTab) {
      return;
    }

    let isMounted = true;

    const fetchStats = async () => {
      try {
        const dashboard = await getAIGovernanceDashboard();
        if (isMounted) {
          setNavStats(dashboard.estateStats);
        }
      } catch {
        if (isMounted) {
          setNavStats(undefined);
        }
      }
    };

    fetchStats();

    return () => {
      isMounted = false;
    };
  }, [isInvalidTab, registryRefreshKey]);

  if (isInvalidTab) {
    return (
      <Navigate
        replace
        to={ROUTES.AI_GOVERNANCE_WITH_TAB.replace(
          PLACEHOLDER_ROUTE_TAB,
          AIGovernanceTab.OVERVIEW
        )}
      />
    );
  }

  const headerLabel = SECTION_TITLES[activeTab] ?? 'label.ai-governance';
  const headerDescription =
    SECTION_DESCRIPTIONS[activeTab] ?? 'message.ai-governance-page-description';

  const sectionsWithOwnHeader: AIGovernanceTab[] = [
    AIGovernanceTab.FRAMEWORKS,
    AIGovernanceTab.POLICIES,
    AIGovernanceTab.REPORTS,
  ];
  const shouldRenderPageHeader = !sectionsWithOwnHeader.includes(activeTab);

  return (
    <div className="ai-gov-page-shell">
      <AIGovernanceSecondaryNav
        activeTab={activeTab}
        approvalsCount={navStats?.pending}
        registryCount={navStats?.total}
        shadowCount={navStats?.shadow}
        onOpenIntake={() => setIntakeOpen(true)}
      />

      <main className="ai-gov-page-content">
        {shouldRenderPageHeader && (
          <PageHeader
            data={{
              header: t(headerLabel),
              subHeader: t(headerDescription),
            }}
          />
        )}
        {activeTab === AIGovernanceTab.OVERVIEW && <OverviewSection />}
        {activeTab === AIGovernanceTab.REGISTRY && (
          <RegistrySection
            refreshKey={registryRefreshKey}
            onOpenIntake={() => setIntakeOpen(true)}
          />
        )}
        {activeTab === AIGovernanceTab.SHADOW && <ShadowSection />}
        {activeTab === AIGovernanceTab.APPROVALS && <ApprovalsSection />}
        {activeTab === AIGovernanceTab.FRAMEWORKS && <FrameworksSection />}
        {activeTab === AIGovernanceTab.POLICIES && <PoliciesSection />}
        {activeTab === AIGovernanceTab.REPORTS && <AuditReportsSection />}
      </main>

      <IntakeWizard
        open={intakeOpen}
        onClose={() => setIntakeOpen(false)}
        onSubmitted={() => setRegistryRefreshKey((key) => key + 1)}
      />
    </div>
  );
};

export default withPageLayout(AIGovernancePage);

export { AIGovernancePage };
