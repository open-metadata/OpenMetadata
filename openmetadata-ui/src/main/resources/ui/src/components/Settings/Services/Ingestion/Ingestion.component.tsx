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

import { ReloadOutlined } from '@ant-design/icons';
import { Button, Col, Radio, RadioChangeEvent, Row, Typography,  } from 'antd';
import { Tooltip } from '../../../common/AntdCompat';;
import { isUndefined } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as MetadataAgentIcon } from '../../../../assets/svg/ic-collapse.svg';
import { ReactComponent as CollateAI } from '../../../../assets/svg/ic-suggestions.svg';
import {
  ServiceAgentSubTabs,
  ServiceCategory,
} from '../../../../enums/service.enum';
import { useFqn } from '../../../../hooks/useFqn';
import { getCountBadge } from '../../../../utils/CommonUtils';
import { getTypeAndStatusMenuItems } from '../../../../utils/IngestionUtils';
import { getServiceDetailsPath } from '../../../../utils/RouterUtils';
import serviceUtilClassBase from '../../../../utils/ServiceUtilClassBase';
import { useRequiredParams } from '../../../../utils/useRequiredParams';
import ErrorPlaceHolderIngestion from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolderIngestion';
import Searchbar from '../../../common/SearchBarComponent/SearchBar.component';
import SearchDropdown from '../../../SearchDropdown/SearchDropdown';
import { IngestionProps } from './ingestion.interface';
import './ingestion.less';

const Ingestion: React.FC<IngestionProps> = ({
  serviceDetails,
  ingestionPipelineList,
  ingestionPagingInfo,
  onIngestionWorkflowsUpdate,
  pipelineType,
  isLoading,
  handleIngestionListUpdate,
  searchText,
  handleSearchChange,
  onPageChange,
  airflowInformation,
  handleTypeFilterChange,
  handleStatusFilterChange,
  statusFilter,
  typeFilter,
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

  const { typeMenuItems, statusMenuItems } = useMemo(
    () => getTypeAndStatusMenuItems(),
    []
  );
  const isDBService = useMemo(
    () => serviceCategory === ServiceCategory.DATABASE_SERVICES,
    [serviceCategory]
  );
  const [statusFilters, setStatusFilters] =
    useState<Array<{ key: string; label: string }>>(statusMenuItems);
  const [typeFilters, setTypeFilters] =
    useState<Array<{ key: string; label: string }>>(typeMenuItems);

  const { CollateAIAgentsWidget, MetadataAgentsWidget } = useMemo(
    () => serviceUtilClassBase.getAgentsTabWidgets(),
    [serviceCategory]
  );
  const isCollateAIWidgetSupported = useMemo(
    () => !isUndefined(CollateAIAgentsWidget) && isDBService,
    [CollateAIAgentsWidget, isDBService]
  );

  const isCollateSubTabSelected = subTab === ServiceAgentSubTabs.COLLATE_AI;

  const { isAirflowAvailable } = useMemo(
    () => airflowInformation,
    [airflowInformation]
  );

  const handleStatusFilterSearch = useCallback(
    (searchValue: string) => {
      setStatusFilters(
        statusMenuItems.filter((item) =>
          item.label.toLowerCase().includes(searchValue.toLowerCase())
        )
      );
    },
    [statusMenuItems]
  );

  const handleTypeFilterSearch = useCallback(
    (searchValue: string) => {
      setTypeFilters(
        typeMenuItems.filter((item) =>
          item.label.toLowerCase().includes(searchValue.toLowerCase())
        )
      );
    },
    [typeMenuItems]
  );

  const handleSubTabChange = useCallback(
    (e: RadioChangeEvent) => {
      const key = e.target.value;

      navigate(
        {
          pathname: getServiceDetailsPath(
            decodedServiceFQN,
            serviceCategory,
            tab,
            key
          ),
        },
        {
          replace: true,
        }
      );
    },
    [history, decodedServiceFQN, serviceCategory, tab]
  );

  const subTabOptions = useMemo(() => {
    return Object.values(ServiceAgentSubTabs).map((tabName) => {
      const Icon =
        tabName === ServiceAgentSubTabs.COLLATE_AI
          ? CollateAI
          : MetadataAgentIcon;
      const label =
        tabName === ServiceAgentSubTabs.COLLATE_AI
          ? t('label.collate-ai')
          : t('label.metadata');

      return {
        label: (
          <div className="tab-label" data-testid={`${tabName}-sub-tab`}>
            <Icon height={14} width={14} />
            <Typography.Text>{label}</Typography.Text>
            {getCountBadge(
              agentCounts?.[tabName],
              'flex-center h-5',
              subTab === tabName
            )}
          </div>
        ),
        value: tabName,
      };
    });
  }, [subTab, agentCounts]);

  if (!isAirflowAvailable) {
    return <ErrorPlaceHolderIngestion />;
  }

  return (
    <div className="agents-tab" data-testid="ingestion-details-container">
      <Row justify="space-between">
        <Col>
          {isCollateAIWidgetSupported && (
            <Radio.Group
              buttonStyle="solid"
              className="agents-sub-tabs-switch"
              data-testid="agents-sub-tabs-switch"
              optionType="button"
              options={subTabOptions}
              size="large"
              value={subTab}
              onChange={handleSubTabChange}
            />
          )}
        </Col>

        <Col className="flex items-center gap-2">
          <Tooltip
            title={t('label.refresh-entity', {
              entity: t('label.agent-plural'),
            })}>
            <Button
              className="reload-button"
              icon={<ReloadOutlined className="reload-button-icon" />}
              size="large"
              onClick={() => refreshAgentsList(subTab as ServiceAgentSubTabs)}
            />
          </Tooltip>
          {!isCollateSubTabSelected && (
            <>
              <SearchDropdown
                hideCounts
                label={t('label.status')}
                options={statusFilters}
                searchKey="status"
                selectedKeys={statusFilter ?? []}
                triggerButtonSize="large"
                onChange={handleStatusFilterChange}
                onSearch={handleStatusFilterSearch}
              />
              <SearchDropdown
                hideCounts
                label={t('label.type')}
                options={typeFilters}
                searchKey="status"
                selectedKeys={typeFilter ?? []}
                triggerButtonSize="large"
                onChange={handleTypeFilterChange}
                onSearch={handleTypeFilterSearch}
              />

              <div className="search-bar-container">
                <Searchbar
                  removeMargin
                  inputClassName="p-x-sm p-y-xs border-radius-xs"
                  placeholder={t('label.search')}
                  searchValue={searchText}
                  typingInterval={500}
                  onSearch={handleSearchChange}
                />
              </div>
            </>
          )}
        </Col>
      </Row>

      {isCollateSubTabSelected ? (
        <CollateAIAgentsWidget
          collateAgentPagingInfo={collateAgentPagingInfo}
          collateAgentsList={collateAgentsList}
          isCollateAgentLoading={isCollateAgentLoading}
          serviceDetails={serviceDetails}
          workflowStartAt={workflowStartAt}
          onCollateAgentPageChange={onCollateAgentPageChange}
        />
      ) : (
        <MetadataAgentsWidget
          airflowInformation={airflowInformation}
          handleIngestionListUpdate={handleIngestionListUpdate}
          ingestionPagingInfo={ingestionPagingInfo}
          ingestionPipelineList={ingestionPipelineList}
          isLoading={isLoading}
          pipelineType={pipelineType}
          searchText={searchText}
          serviceDetails={serviceDetails}
          serviceName={decodedServiceFQN}
          onIngestionWorkflowsUpdate={onIngestionWorkflowsUpdate}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
};

export default Ingestion;
