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
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DISABLED } from '../../../../constants/constants';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import {
  IngestionServicePermission,
  ResourceEntity,
} from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { IngestionPipeline } from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import LimitWrapper from '../../../../hoc/LimitWrapper';
import {
  deleteIngestionPipelineById,
  deployIngestionPipelineById,
  enableDisableIngestionPipelineById,
  triggerIngestionPipelineById,
} from '../../../../rest/ingestionPipelineAPI';
import { getEntityName } from '../../../../utils/EntityUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import ErrorPlaceHolderIngestion from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolderIngestion';
import Searchbar from '../../../common/SearchBarComponent/SearchBar.component';
import ButtonSkeleton from '../../../common/Skeleton/CommonSkeletons/ControlElements/ControlElements.component';
import EntityDeleteModal from '../../../Modals/EntityDeleteModal/EntityDeleteModal';
import AddIngestionButton from './AddIngestionButton.component';
import { IngestionProps, SelectedRowDetails } from './ingestion.interface';
import IngestionListTable from './IngestionListTable/IngestionListTable';

const Ingestion: React.FC<IngestionProps> = ({
  serviceName,
  serviceCategory,
  serviceDetails,
  ingestionPipelineList,
  paging,
  onIngestionWorkflowsUpdate,
  permissions,
  pipelineType,
  displayAddIngestionButton = true,
  pipelineNameColWidth,
  containerClassName,
  isAirflowAvailable = true,
  isLoading,
  handleIngestionListUpdate,
  handleIngestionPagingUpdate,
  searchText,
  handleSearchChange,
  onPageChange,
  currentPage,
  airflowInformation,
}: IngestionProps) => {
  const { t } = useTranslation();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [deleteSelection, setDeleteSelection] = useState<SelectedRowDetails>({
    id: '',
    name: '',
    state: '',
  });
  const [pipelineIdToFetchStatus, setPipelineIdToFetchStatus] =
    useState<string>();

  const handlePipelineIdToFetchStatus = useCallback((pipelineId?: string) => {
    setPipelineIdToFetchStatus(pipelineId);
  }, []);

  const handleDeleteSelection = useCallback(
    (row: SelectedRowDetails) => setDeleteSelection(row),
    [setDeleteSelection]
  );

  const handleIsConfirmationModalOpen = useCallback(
    (value: boolean) => setIsConfirmationModalOpen(value),
    [setDeleteSelection]
  );

  const [ingestionPipelinesPermission, setIngestionPipelinesPermission] =
    useState<IngestionServicePermission>();

  const deleteIngestion = useCallback(
    async (id: string, displayName: string) => {
      try {
        await deleteIngestionPipelineById(id);
        handleIngestionListUpdate((pipelines) =>
          pipelines.filter((ing) => ing.id !== id)
        );
        // Update the paging total count to reflect on tab count
        handleIngestionPagingUpdate((prevData) => ({
          ...prevData,
          total: prevData.total > 0 ? prevData.total - 1 : 0,
        }));
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.ingestion-workflow-operation-error', {
            operation: t('label.deleting-lowercase'),
            displayName,
          })
        );
      }
    },
    [handleIngestionListUpdate, handleIngestionPagingUpdate]
  );

  const updateCurrentSelectedIngestion = useCallback(
    (
      id: string,
      data: IngestionPipeline | undefined,
      updateKey: keyof IngestionPipeline,
      isDeleted = false
    ) => {
      const rowIndex = ingestionPipelineList.findIndex((row) => row.id === id);

      const updatedRow = !isUndefined(data)
        ? { ...ingestionPipelineList[rowIndex], [updateKey]: data[updateKey] }
        : null;

      const updatedData = isDeleted
        ? ingestionPipelineList.filter((_, index) => index !== rowIndex)
        : undefined;

      const ingestionPipelinesList = updatedRow
        ? Object.assign([...ingestionPipelineList], { [rowIndex]: updatedRow })
        : [...ingestionPipelineList];

      handleIngestionListUpdate(updatedData ?? ingestionPipelinesList);
    },
    [ingestionPipelineList]
  );

  const handleEnableDisableIngestion = useCallback(
    async (id: string) => {
      try {
        const response = await enableDisableIngestionPipelineById(id);

        if (response.data) {
          updateCurrentSelectedIngestion(id, response.data, 'enabled');
        }
      } catch (error) {
        showErrorToast(error as AxiosError, t('server.unexpected-response'));
      }
    },
    [updateCurrentSelectedIngestion]
  );

  const triggerIngestion = useCallback(
    async (id: string, displayName: string) => {
      try {
        await triggerIngestionPipelineById(id);
        showSuccessToast(
          t('message.pipeline-action-success-message', {
            action: t('label.triggered-lowercase'),
          })
        );

        handlePipelineIdToFetchStatus(id);
      } catch (err) {
        showErrorToast(
          t('message.ingestion-workflow-operation-error', {
            operation: t('label.triggering-lowercase'),
            displayName,
          })
        );
      }
    },
    [handlePipelineIdToFetchStatus]
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
          handlePipelineIdToFetchStatus(id);
        }, 500);
      } catch (error) {
        showErrorToast(
          t('message.ingestion-workflow-operation-error', {
            operation: t('label.deploying-lowercase'),
            displayName,
          })
        );
      }
    },
    [handlePipelineIdToFetchStatus]
  );

  const fetchIngestionPipelinesPermission = async () => {
    try {
      const promises = ingestionPipelineList.map((item) =>
        getEntityPermissionByFqn(ResourceEntity.INGESTION_PIPELINE, item.name)
      );
      const response = await Promise.allSettled(promises);

      const permissionData = response.reduce((acc, cv, index) => {
        return {
          ...acc,
          [ingestionPipelineList?.[index].name]:
            cv.status === 'fulfilled' ? cv.value : {},
        };
      }, {});

      setIngestionPipelinesPermission(permissionData);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const handleCancelConfirmationModal = () => {
    setIsConfirmationModalOpen(false);
    setDeleteSelection({
      id: '',
      name: '',
      state: '',
    });
  };

  const handleDelete = async (id: string, displayName: string) => {
    setDeleteSelection({ id, name: displayName, state: 'waiting' });
    try {
      await deleteIngestion(id, displayName);
      handleCancelConfirmationModal();
    } catch (error) {
      handleCancelConfirmationModal();
    }
  };

  const { isFetchingStatus, platform } = useMemo(
    () => airflowInformation,
    [airflowInformation]
  );

  const showAddIngestionButton = useMemo(
    () =>
      permissions.EditAll && displayAddIngestionButton && platform !== DISABLED,
    [permissions, displayAddIngestionButton, platform]
  );

  const renderAddIngestionButton = useMemo(() => {
    if (isFetchingStatus) {
      return <ButtonSkeleton size="default" />;
    }

    if (showAddIngestionButton) {
      return (
        <LimitWrapper resource="ingestionPipeline">
          <AddIngestionButton
            ingestionList={ingestionPipelineList}
            permissions={permissions}
            pipelineType={pipelineType}
            serviceCategory={serviceCategory}
            serviceDetails={serviceDetails}
            serviceName={serviceName}
          />
        </LimitWrapper>
      );
    }

    return null;
  }, [
    isFetchingStatus,
    showAddIngestionButton,
    ingestionPipelineList,
    permissions,
    pipelineType,
    serviceCategory,
    serviceDetails,
    serviceName,
  ]);

  useEffect(() => {
    fetchIngestionPipelinesPermission();
  }, [ingestionPipelineList]);

  const getIngestionTab = () => {
    return (
      <Row
        className={classNames('mt-4', containerClassName ?? '')}
        data-testid="ingestion-details-container">
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
            currentPage={currentPage}
            deployIngestion={deployIngestion}
            handleDeleteSelection={handleDeleteSelection}
            handleEnableDisableIngestion={handleEnableDisableIngestion}
            handleIsConfirmationModalOpen={handleIsConfirmationModalOpen}
            handlePipelineIdToFetchStatus={handlePipelineIdToFetchStatus}
            ingestionData={ingestionPipelineList}
            ingestionPipelinesPermission={ingestionPipelinesPermission}
            isLoading={isLoading}
            paging={paging}
            pipelineIdToFetchStatus={pipelineIdToFetchStatus}
            pipelineNameColWidth={pipelineNameColWidth}
            pipelineType={pipelineType}
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

  if (!isAirflowAvailable) {
    return <ErrorPlaceHolderIngestion />;
  }

  return (
    <div data-testid="ingestion-container">
      {getIngestionTab()}
      <EntityDeleteModal
        entityName={getEntityName(deleteSelection)}
        entityType={t('label.ingestion-lowercase')}
        visible={isConfirmationModalOpen}
        onCancel={handleCancelConfirmationModal}
        onConfirm={() =>
          handleDelete(deleteSelection.id, getEntityName(deleteSelection))
        }
      />
    </div>
  );
};

export default Ingestion;
