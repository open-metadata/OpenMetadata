/*
 *  Copyright 2025 Collate.
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
import { Card, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import MetadataAgentIcon from '../../../../../assets/svg/application.svg?react';
import { DISABLED } from '../../../../../constants/constants';
import { usePermissionProvider } from '../../../../../context/PermissionProvider/PermissionProvider';
import { ServiceCategory } from '../../../../../enums/service.enum';
import {
  deployIngestionPipelineById,
  enableDisableIngestionPipelineById,
  triggerIngestionPipelineById,
} from '../../../../../rest/ingestionPipelineAPI';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../utils/ToastUtils';
import { useRequiredParams } from '../../../../../utils/useRequiredParams';
import ButtonSkeleton from '../../../../common/Skeleton/CommonSkeletons/ControlElements/ControlElements.component';
import AddIngestionButton from '../AddIngestionButton.component';
import IngestionListTable from '../IngestionListTable/IngestionListTable';
import './metadata-agents-widget.less';
import { MetadataAgentsWidgetProps } from './MetadataAgentsWidget.interface';

function MetadataAgentsWidget({
  serviceName,
  serviceDetails,
  ingestionPipelineList,
  ingestionPagingInfo,
  onIngestionWorkflowsUpdate,
  pipelineType,
  isLoading,
  handleIngestionListUpdate,
  onPageChange,
  airflowInformation,
  searchText,
}: Readonly<MetadataAgentsWidgetProps>) {
  const { t } = useTranslation();
  const { serviceCategory } = useRequiredParams<{
    serviceCategory: ServiceCategory;
  }>();
  const [pipelineIdToFetchStatus, setPipelineIdToFetchStatus] =
    useState<string>();

  const { isFetchingStatus, platform } = useMemo(
    () => airflowInformation,
    [airflowInformation]
  );

  const { permissions } = usePermissionProvider();

  const ingestionPermissions = useMemo(
    () => permissions['ingestionPipeline'],
    [permissions]
  );

  const showAddIngestionButton = useMemo(
    () => ingestionPermissions.Create && platform !== DISABLED,
    [ingestionPermissions, platform]
  );

  const handlePipelineIdToFetchStatus = useCallback((pipelineId?: string) => {
    setPipelineIdToFetchStatus(pipelineId);
  }, []);

  const handleEnableDisableIngestion = useCallback(async (id: string) => {
    try {
      const { data } = await enableDisableIngestionPipelineById(id);

      if (data.id) {
        handleIngestionListUpdate((list) =>
          list.map((row) =>
            row.id === id ? { ...row, enabled: data.enabled } : row
          )
        );
      }
    } catch (error) {
      showErrorToast(error as AxiosError, t('server.unexpected-response'));
    }
  }, []);

  const triggerIngestion = useCallback(
    async (id: string, displayName: string) => {
      try {
        await triggerIngestionPipelineById(id);
        showSuccessToast(
          t('message.pipeline-action-success-message', {
            action: t('label.triggered-lowercase'),
          })
        );

        // To fetch pipeline status on demand
        // adding a delay to account for the delay in the pipeline service to update the status
        setTimeout(() => {
          setPipelineIdToFetchStatus(id);
        }, 500);
      } catch (err) {
        showErrorToast(
          t('server.ingestion-workflow-operation-error', {
            operation: t('label.triggering-lowercase'),
            displayName,
          })
        );
      }
    },
    []
  );

  const deployIngestion = useCallback(
    async (id: string, displayName: string) => {
      try {
        await deployIngestionPipelineById(id);
        showSuccessToast(
          t('message.pipeline-action-success-message', {
            action: t('label.deployed-lowercase'),
          })
        );

        // To fetch pipeline status on demand
        // adding a delay to account for the delay in the pipeline service to update the status
        setTimeout(() => {
          setPipelineIdToFetchStatus(id);
        }, 500);
      } catch (error) {
        showErrorToast(
          t('server.ingestion-workflow-operation-error', {
            operation: t('label.deploying-lowercase'),
            displayName,
          })
        );
      }
    },
    []
  );

  const renderAddIngestionButton = useMemo(() => {
    if (isFetchingStatus) {
      return <ButtonSkeleton size="default" />;
    }

    if (showAddIngestionButton) {
      return (
        <AddIngestionButton
          ingestionList={ingestionPipelineList}
          pipelineType={pipelineType}
          serviceCategory={serviceCategory}
          serviceDetails={serviceDetails}
          serviceName={serviceName}
        />
      );
    }

    return null;
  }, [
    isFetchingStatus,
    showAddIngestionButton,
    ingestionPipelineList,
    pipelineType,
    serviceCategory,
    serviceDetails,
    serviceName,
  ]);

  return (
    <Card className="metadata-agents-widget">
      <div className="p-md flex items-center justify-between">
        <div className="flex gap-4 items-center">
          <div className="agent-icon-container">
            <MetadataAgentIcon height={16} width={16} />
          </div>
          <div className="flex flex-col gap-1">
            <Typography.Text className="font-medium text-md">
              {t('label.metadata-agent-plural')}
            </Typography.Text>
            <Typography.Text className="text-grey-muted text-sm">
              {t('message.metadata-agents-table-description')}
            </Typography.Text>
          </div>
        </div>
        <div className="flex-center">{renderAddIngestionButton}</div>
      </div>

      <IngestionListTable
        airflowInformation={airflowInformation}
        deployIngestion={deployIngestion}
        handleEnableDisableIngestion={handleEnableDisableIngestion}
        handleIngestionListUpdate={handleIngestionListUpdate}
        handlePipelineIdToFetchStatus={handlePipelineIdToFetchStatus}
        ingestionData={ingestionPipelineList}
        ingestionPagingInfo={ingestionPagingInfo}
        isLoading={isLoading}
        isNumberBasedPaging={!isEmpty(searchText)}
        pipelineIdToFetchStatus={pipelineIdToFetchStatus}
        pipelineType={pipelineType}
        searchText={searchText}
        serviceCategory={serviceCategory}
        serviceName={serviceName}
        tableContainerClassName="metadata-agents-widget-table"
        triggerIngestion={triggerIngestion}
        onIngestionWorkflowsUpdate={onIngestionWorkflowsUpdate}
        onPageChange={onPageChange}
      />
    </Card>
  );
}

export default MetadataAgentsWidget;
