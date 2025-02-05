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

import { Col, Row } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DISABLED } from '../../../../constants/constants';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import {
  deployIngestionPipelineById,
  enableDisableIngestionPipelineById,
  triggerIngestionPipelineById,
} from '../../../../rest/ingestionPipelineAPI';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import ErrorPlaceHolderIngestion from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolderIngestion';
import Searchbar from '../../../common/SearchBarComponent/SearchBar.component';
import ButtonSkeleton from '../../../common/Skeleton/CommonSkeletons/ControlElements/ControlElements.component';
import AddIngestionButton from './AddIngestionButton.component';
import { IngestionProps } from './ingestion.interface';
import IngestionListTable from './IngestionListTable/IngestionListTable';

const Ingestion: React.FC<IngestionProps> = ({
  serviceName,
  serviceCategory,
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
}: IngestionProps) => {
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  const [pipelineIdToFetchStatus, setPipelineIdToFetchStatus] =
    useState<string>();

  const ingestionPermissions = useMemo(
    () => permissions['ingestionPipeline'],
    [permissions]
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

        setPipelineIdToFetchStatus(id);
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

  const { isAirflowAvailable, isFetchingStatus, platform } = useMemo(
    () => airflowInformation,
    [airflowInformation]
  );

  const showAddIngestionButton = useMemo(
    () => ingestionPermissions.Create && platform !== DISABLED,
    [ingestionPermissions, platform]
  );

  const renderAddIngestionButton = useMemo(() => {
    if (isFetchingStatus || isLoading) {
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
    isLoading,
    isFetchingStatus,
    showAddIngestionButton,
    ingestionPipelineList,
    pipelineType,
    serviceCategory,
    serviceDetails,
    serviceName,
  ]);

  if (!isAirflowAvailable) {
    return <ErrorPlaceHolderIngestion />;
  }

  return (
    <Row className="mt-4" data-testid="ingestion-details-container">
      <Col className="d-flex justify-between" span={24}>
        <div className="w-max-400 w-full">
          <Searchbar
            placeholder={`${t('message.search-for-ingestion')}...`}
            searchValue={searchText}
            typingInterval={500}
            onSearch={handleSearchChange}
          />
        </div>
        <div className="relative">{renderAddIngestionButton}</div>
      </Col>
      <Col span={24}>
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
          triggerIngestion={triggerIngestion}
          onIngestionWorkflowsUpdate={onIngestionWorkflowsUpdate}
          onPageChange={onPageChange}
        />
      </Col>
    </Row>
  );
};

export default Ingestion;
