/*
 *  Copyright 2022 Collate.
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

import { Tabs } from '@openmetadata/ui-core-components';
import { isUndefined } from 'lodash';
import { ComponentType, Key, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as MetadataAgentIcon } from '../../../../assets/svg/ic-collapse.svg';
import { ReactComponent as CollateAI } from '../../../../assets/svg/ic-suggestions.svg';
import { DISABLED } from '../../../../constants/constants';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import {
  ServiceAgentSubTabs,
  ServiceCategory,
} from '../../../../enums/service.enum';
import { useFqn } from '../../../../hooks/useFqn';
import { getServiceDetailsPath } from '../../../../utils/RouterUtils';
import { getDefaultAgentsTabWidgets } from '../../../../utils/ServiceInsightsWidgets';
import serviceUtilClassBase from '../../../../utils/ServiceUtilClassBase';
import { useRequiredParams } from '../../../../utils/useRequiredParams';
import ErrorPlaceHolderIngestion from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolderIngestion';
import DeploymentSummaryCard from '../../../ServiceAgents/components/DeploymentSummaryCard.component';
import MetadataAgentsView from '../../../ServiceAgents/components/MetadataAgentsView.component';
import { useMetadataAgents } from '../../../ServiceAgents/hooks/useMetadataAgents';
import { IngestionProps } from './ingestion.interface';
import './ingestion.less';

const Ingestion: React.FC<IngestionProps> = ({
  serviceDetails,
  ingestionPipelineList,
  airflowInformation,
  isCollateAgentLoading,
  collateAgentsList,
  collateAgentPagingInfo,
  onCollateAgentPageChange,
  agentCounts,
  refreshAgentsList,
  workflowStartAt,
}: IngestionProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { fqn: decodedServiceFQN } = useFqn();
  const { serviceCategory, tab, subTab } = useRequiredParams<{
    serviceCategory: ServiceCategory;
    tab: string;
    subTab: string;
  }>();
  const { permissions } = usePermissionProvider();

  const { agents } = useMetadataAgents(
    ingestionPipelineList,
    serviceCategory,
    decodedServiceFQN
  );

  const isDBService = useMemo(
    () => serviceCategory === ServiceCategory.DATABASE_SERVICES,
    [serviceCategory]
  );

  const { CollateAIAgentsWidget } = useMemo(
    () => ({
      ...getDefaultAgentsTabWidgets(),
      ...serviceUtilClassBase.getAgentsTabWidgets(),
    }),
    [serviceCategory]
  );

  // The community widget registry types every entry as the metadata widget;
  // the Collate edition overrides it with the real Collate AI widget. Treat it
  // as a props-bag component so the Collate sub-tab can render either.
  const CollateAgentsWidget = CollateAIAgentsWidget as unknown as ComponentType<
    Record<string, unknown>
  >;

  const isCollateAIWidgetSupported = useMemo(
    () => !isUndefined(CollateAIAgentsWidget) && isDBService,
    [CollateAIAgentsWidget, isDBService]
  );

  const isCollateSubTabSelected = subTab === ServiceAgentSubTabs.COLLATE_AI;

  const { isAirflowAvailable, platform } = useMemo(
    () => airflowInformation,
    [airflowInformation]
  );

  const showAddAgent = useMemo(
    () =>
      Boolean(permissions['ingestionPipeline']?.Create) &&
      platform !== DISABLED,
    [permissions, platform]
  );

  const handleSubTabChange = useCallback(
    (key: Key) => {
      navigate(
        {
          pathname: getServiceDetailsPath(
            decodedServiceFQN,
            serviceCategory,
            tab,
            String(key)
          ),
        },
        { replace: true }
      );
    },
    [decodedServiceFQN, serviceCategory, tab, navigate]
  );

  const handleRefresh = useCallback(
    () => refreshAgentsList(subTab as ServiceAgentSubTabs),
    [refreshAgentsList, subTab]
  );

  const subTabItems = useMemo(() => {
    return Object.values(ServiceAgentSubTabs).map((tabName) => {
      const Icon =
        tabName === ServiceAgentSubTabs.COLLATE_AI
          ? CollateAI
          : MetadataAgentIcon;
      const label =
        tabName === ServiceAgentSubTabs.COLLATE_AI
          ? t('label.collate-ai')
          : t('label.metadata');

      return (
        <Tabs.Item
          badge={String(agentCounts?.[tabName] ?? 0)}
          data-testid={`${tabName}-sub-tab`}
          id={tabName}
          key={tabName}>
          <Icon height={16} width={16} />
          {label}
        </Tabs.Item>
      );
    });
  }, [agentCounts, t]);

  if (!isAirflowAvailable) {
    return <ErrorPlaceHolderIngestion />;
  }

  return (
    <div className="agents-tab" data-testid="ingestion-details-container">
      <DeploymentSummaryCard agents={agents} />

      {isCollateAIWidgetSupported && (
        <Tabs
          className="tw:w-full"
          data-testid="agents-sub-tabs-switch"
          selectedKey={subTab}
          onSelectionChange={handleSubTabChange}>
          <Tabs.List type="underline">{subTabItems}</Tabs.List>
        </Tabs>
      )}

      {isCollateSubTabSelected ? (
        <CollateAgentsWidget
          collateAgentPagingInfo={collateAgentPagingInfo}
          collateAgentsList={collateAgentsList}
          isCollateAgentLoading={isCollateAgentLoading}
          serviceDetails={serviceDetails}
          workflowStartAt={workflowStartAt}
          onCollateAgentPageChange={onCollateAgentPageChange}
        />
      ) : (
        <MetadataAgentsView
          agents={agents}
          ingestionPipelineList={ingestionPipelineList}
          serviceCategory={serviceCategory}
          serviceDetails={serviceDetails}
          serviceName={decodedServiceFQN}
          showAddAgent={showAddAgent}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  );
};

export default Ingestion;
