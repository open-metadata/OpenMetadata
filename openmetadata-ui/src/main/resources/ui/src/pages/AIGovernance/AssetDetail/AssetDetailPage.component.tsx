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

import { AxiosError } from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  PLACEHOLDER_ROUTE_ENTITY_TYPE,
  PLACEHOLDER_ROUTE_FQN,
  PLACEHOLDER_ROUTE_TAB,
  ROUTES,
} from '../../../constants/constants';
import { withPageLayout } from '../../../hoc/withPageLayout';
import { getAIApplicationByFqn } from '../../../rest/aiApplicationAPI';
import { getLLMModelByFqn } from '../../../rest/llmModelAPI';
import { getMcpServerByFqn } from '../../../rest/mcpServerAPI';
import { getDecodedFqn } from '../../../utils/StringUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { AIGovernanceTab } from '../AIGovernancePage.interface';
import {
  Card,
  Empty,
  Skeleton,
  Tabs,
} from '../components/AIGovUntitled.component';
import { IcArrL, IcChevR } from '../icons/AIGovIcons';
import '../styles/ai-gov-pills.less';
import ActivityTab from './ActivityTab.component';
import './asset-detail.less';
import {
  AIAssetEntityType,
  AIAssetView,
  AssetDetailTab,
} from './AssetDetail.types';
import {
  aiApplicationToView,
  llmModelToView,
  mcpServerToView,
} from './AssetDetail.utils';
import { AssetDetailHeader } from './AssetDetailHeader.component';
import ComplianceTab from './ComplianceTab.component';
import LineageTab from './LineageTab.component';
import OverviewTab from './OverviewTab.component';
import PoliciesTab from './PoliciesTab.component';

interface AssetDetailPageProps {
  pageTitle: string;
}

const ENTITY_FIELDS_BY_TYPE: Record<AIAssetEntityType, string> = {
  aiApplication:
    'owners,domain,domains,tags,governanceMetadata,applicationType,biasMetrics,performanceMetrics,qualityMetrics,safetyMetrics',
  llmModel:
    'owners,domain,domains,tags,deploymentInfo,governanceStatus,modelType,costMetrics,regulatoryCompliance',
  mcpServer:
    'owners,domain,domains,tags,governanceMetadata,serverType,usageMetrics,securityMetrics',
};

const buildTabRoute = (
  entityType: AIAssetEntityType,
  fqn: string,
  tab: AssetDetailTab
) =>
  ROUTES.AI_GOVERNANCE_ASSET_DETAILS_WITH_TAB.replace(
    PLACEHOLDER_ROUTE_ENTITY_TYPE,
    entityType
  )
    .replace(PLACEHOLDER_ROUTE_FQN, encodeURIComponent(fqn))
    .replace(PLACEHOLDER_ROUTE_TAB, tab);

const fetchAssetByType = async (
  entityType: AIAssetEntityType,
  fqn: string
): Promise<AIAssetView> => {
  const fields = ENTITY_FIELDS_BY_TYPE[entityType];
  if (entityType === 'aiApplication') {
    return aiApplicationToView(await getAIApplicationByFqn(fqn, { fields }));
  }
  if (entityType === 'llmModel') {
    return llmModelToView(await getLLMModelByFqn(fqn, { fields }));
  }

  return mcpServerToView(await getMcpServerByFqn(fqn, { fields }));
};

const isValidEntityType = (
  value: string | undefined
): value is AIAssetEntityType =>
  value === 'aiApplication' || value === 'llmModel' || value === 'mcpServer';

const AssetDetailPage = ({ pageTitle: _pageTitle }: AssetDetailPageProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { entityType, fqn, tab } = useParams<{
    entityType?: string;
    fqn?: string;
    tab?: string;
  }>();

  const [view, setView] = useState<AIAssetView | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const decodedFqn = useMemo(
    () => (fqn ? getDecodedFqn(fqn) : undefined),
    [fqn]
  );

  const activeTab = useMemo<AssetDetailTab>(() => {
    const tabValues = Object.values(AssetDetailTab) as string[];

    return tab && tabValues.includes(tab)
      ? (tab as AssetDetailTab)
      : AssetDetailTab.OVERVIEW;
  }, [tab]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!isValidEntityType(entityType) || !decodedFqn) {
        setNotFound(true);
        setLoading(false);

        return;
      }
      setLoading(true);
      setNotFound(false);
      try {
        const next = await fetchAssetByType(entityType, decodedFqn);
        if (!cancelled) {
          setView(next);
        }
      } catch (error) {
        if (!cancelled) {
          setNotFound(true);
          showErrorToast(error as AxiosError);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [entityType, decodedFqn, refreshKey]);

  const reloadAsset = () => setRefreshKey((k) => k + 1);

  const handleTabChange = (next: string) => {
    if (!view) {
      return;
    }
    navigate(
      buildTabRoute(
        view.entityType,
        view.fullyQualifiedName,
        next as AssetDetailTab
      )
    );
  };

  if (loading) {
    return (
      <div className="tw:p-6">
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  if (notFound || !view) {
    return (
      <div className="tw:p-6">
        <Card>
          <Empty
            description={t('label.no-entity', {
              entity: t('label.ai-asset-plural'),
            })}
          />
        </Card>
      </div>
    );
  }

  const registryRoute = ROUTES.AI_GOVERNANCE_WITH_TAB.replace(
    PLACEHOLDER_ROUTE_TAB,
    AIGovernanceTab.REGISTRY
  );

  return (
    <div className="tw:p-6">
      <div className="ai-gov-detail-breadcrumb">
        <Link className="ai-gov-detail-back" to={registryRoute}>
          <IcArrL style={{ width: 14, height: 14 }} />
          {t('label.ai-asset-registry')}
        </Link>
        <IcChevR style={{ width: 12, height: 12 }} />
        <span className="ai-gov-detail-crumb-current">
          {view.displayName ?? view.name}
        </span>
      </div>

      <AssetDetailHeader view={view} onReload={reloadAsset} />

      <Tabs
        className="tw:mt-4"
        selectedKey={activeTab}
        onSelectionChange={(key) => handleTabChange(String(key))}>
        <Tabs.List type="underline">
          <Tabs.Item id={AssetDetailTab.OVERVIEW} label={t('label.overview')} />
          <Tabs.Item
            id={AssetDetailTab.COMPLIANCE}
            label={t('label.compliance')}
          />
          <Tabs.Item id={AssetDetailTab.LINEAGE} label={t('label.lineage')} />
          <Tabs.Item
            id={AssetDetailTab.POLICIES}
            label={t('label.policy-plural')}
          />
          <Tabs.Item id={AssetDetailTab.ACTIVITY} label={t('label.activity')} />
        </Tabs.List>
        <Tabs.Panel id={AssetDetailTab.OVERVIEW}>
          <OverviewTab view={view} />
        </Tabs.Panel>
        <Tabs.Panel id={AssetDetailTab.COMPLIANCE}>
          <ComplianceTab view={view} />
        </Tabs.Panel>
        <Tabs.Panel id={AssetDetailTab.LINEAGE}>
          <LineageTab view={view} />
        </Tabs.Panel>
        <Tabs.Panel id={AssetDetailTab.POLICIES}>
          <PoliciesTab view={view} />
        </Tabs.Panel>
        <Tabs.Panel id={AssetDetailTab.ACTIVITY}>
          <ActivityTab view={view} />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
};

export default withPageLayout(AssetDetailPage);

export { AssetDetailPage };
