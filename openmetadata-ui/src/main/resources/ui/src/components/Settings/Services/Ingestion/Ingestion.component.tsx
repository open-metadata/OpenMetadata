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

import { Alert, Col, Row } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty, isUndefined, lowerCase } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DISABLED } from '../../../../constants/constants';
import { usePermissionProvider } from '../../../../context/PermissionProvider/PermissionProvider';
import {
  IngestionServicePermission,
  ResourceEntity,
} from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { IngestionPipeline } from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { useAirflowStatus } from '../../../../hooks/useAirflowStatus';
import { showErrorToast } from '../../../../utils/ToastUtils';
import ErrorPlaceHolderIngestion from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolderIngestion';
import Searchbar from '../../../common/SearchBarComponent/SearchBar.component';
import ButtonSkeleton from '../../../common/Skeleton/CommonSkeletons/ControlElements/ControlElements.component';
import EntityDeleteModal from '../../../Modals/EntityDeleteModal/EntityDeleteModal';
import AddIngestionButton from './AddIngestionButton.component';
import { IngestionProps, SelectedRowDetails } from './ingestion.interface';
import IngestionListTable from './IngestionListTable.component';

const Ingestion: React.FC<IngestionProps> = ({
  airflowEndpoint,
  serviceName,
  serviceCategory,
  serviceDetails,
  ingestionList,
  isRequiredDetailsAvailable,
  deleteIngestion,
  triggerIngestion,
  deployIngestion,
  paging,
  handleEnableDisableIngestion,
  onIngestionWorkflowsUpdate,
  permissions,
  pipelineType,
  displayAddIngestionButton = true,
  handleIngestionDataChange,
  pipelineNameColWidth,
  containerClassName,
  isAirflowAvailable = true,
  isLoading,
}: IngestionProps) => {
  const { t } = useTranslation();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { isFetchingStatus, platform } = useAirflowStatus();
  const [searchText, setSearchText] = useState('');
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [deleteSelection, setDeleteSelection] = useState<SelectedRowDetails>({
    id: '',
    name: '',
    state: '',
  });

  const handleDeleteSelection = useCallback(
    (row: SelectedRowDetails) => setDeleteSelection(row),
    [setDeleteSelection]
  );

  const handleIsConfirmationModalOpen = useCallback(
    (value: boolean) => setIsConfirmationModalOpen(value),
    [setDeleteSelection]
  );

  const handleSearchAction = (searchValue: string) => {
    setSearchText(searchValue);
  };

  const [ingestionData, setIngestionData] =
    useState<Array<IngestionPipeline>>(ingestionList);
  const [ingestionPipelinesPermission, setIngestionPipelinesPermission] =
    useState<IngestionServicePermission>();

  const fetchIngestionPipelinesPermission = async () => {
    try {
      const promises = ingestionList.map((item) =>
        getEntityPermissionByFqn(ResourceEntity.INGESTION_PIPELINE, item.name)
      );
      const response = await Promise.allSettled(promises);

      const permissionData = response.reduce((acc, cv, index) => {
        return {
          ...acc,
          [ingestionList?.[index].name]:
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

      setTimeout(() => {
        setDeleteSelection({ id, name: displayName, state: 'success' });
        handleCancelConfirmationModal();
      }, 500);
    } catch (error) {
      handleCancelConfirmationModal();
    }
  };

  const getSearchedIngestions = () => {
    const sText = lowerCase(searchText);
    const data = sText
      ? ingestionList.filter(
          (ing) =>
            lowerCase(ing.displayName).includes(sText) ||
            lowerCase(ing.name).includes(sText)
        )
      : ingestionList;

    setIngestionData(data);
    !isUndefined(handleIngestionDataChange) && handleIngestionDataChange(data);
  };

  const showAddIngestionButton = useMemo(
    () =>
      isRequiredDetailsAvailable &&
      permissions.EditAll &&
      displayAddIngestionButton &&
      platform !== DISABLED,
    [
      isRequiredDetailsAvailable,
      permissions,
      displayAddIngestionButton,
      platform,
    ]
  );

  const renderAddIngestionButton = useMemo(() => {
    if (isFetchingStatus) {
      return <ButtonSkeleton size="default" />;
    }

    if (showAddIngestionButton) {
      return (
        <AddIngestionButton
          ingestionData={ingestionData}
          ingestionList={ingestionList}
          permissions={permissions}
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
    ingestionData,
    ingestionList,
    permissions,
    pipelineType,
    serviceCategory,
    serviceDetails,
    serviceName,
  ]);

  useEffect(() => {
    getSearchedIngestions();
  }, [searchText, ingestionList]);

  useEffect(() => {
    fetchIngestionPipelinesPermission();
  }, [ingestionList]);

  const getIngestionTab = () => {
    return (
      <Row
        className={classNames('mt-4', containerClassName ?? '')}
        data-testid="ingestion-details-container">
        <Col span={24}>
          {!isRequiredDetailsAvailable && (
            <Alert
              showIcon
              className="mb-4"
              message={t('message.no-service-connection-details-message', {
                serviceName,
              })}
              type="error"
            />
          )}
        </Col>
        <Col className="d-flex justify-between" span={24}>
          <div className="w-max-400 w-full">
            {searchText || !isEmpty(ingestionData) ? (
              <Searchbar
                placeholder={`${t('message.search-for-ingestion')}...`}
                searchValue={searchText}
                typingInterval={500}
                onSearch={handleSearchAction}
              />
            ) : null}
          </div>
          <div className="relative">{renderAddIngestionButton}</div>
        </Col>
        <Col span={24}>
          <IngestionListTable
            airflowEndpoint={airflowEndpoint}
            deleteSelection={deleteSelection}
            deployIngestion={deployIngestion}
            handleDeleteSelection={handleDeleteSelection}
            handleEnableDisableIngestion={handleEnableDisableIngestion}
            handleIsConfirmationModalOpen={handleIsConfirmationModalOpen}
            ingestionData={ingestionData}
            ingestionPipelinesPermission={ingestionPipelinesPermission}
            isLoading={isLoading}
            isRequiredDetailsAvailable={isRequiredDetailsAvailable}
            paging={paging}
            permissions={permissions}
            pipelineNameColWidth={pipelineNameColWidth}
            pipelineType={pipelineType}
            serviceCategory={serviceCategory}
            serviceName={serviceName}
            triggerIngestion={triggerIngestion}
            onIngestionWorkflowsUpdate={onIngestionWorkflowsUpdate}
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
        entityName={deleteSelection.name}
        entityType={t('label.ingestion-lowercase')}
        visible={isConfirmationModalOpen}
        onCancel={handleCancelConfirmationModal}
        onConfirm={() => handleDelete(deleteSelection.id, deleteSelection.name)}
      />
    </div>
  );
};

export default Ingestion;
