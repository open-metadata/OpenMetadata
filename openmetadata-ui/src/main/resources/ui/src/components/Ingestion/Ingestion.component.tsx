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

import { ExclamationCircleOutlined } from '@ant-design/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty, lowerCase } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IngestionPipeline } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { showErrorToast } from '../../utils/ToastUtils';
import Searchbar from '../common/searchbar/Searchbar';
import EntityDeleteModal from '../Modals/EntityDeleteModal/EntityDeleteModal';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';
import {
  IngestionServicePermission,
  ResourceEntity,
} from '../PermissionProvider/PermissionProvider.interface';
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
}: IngestionProps) => {
  const { t } = useTranslation();
  const { getEntityPermissionByFqn } = usePermissionProvider();
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
  const [servicePermission, setServicePermission] =
    useState<IngestionServicePermission>();

  const fetchServicePermission = async () => {
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

      setServicePermission(permissionData);
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

  const handleDelete = (id: string, displayName: string) => {
    setDeleteSelection({ id, name: displayName, state: 'waiting' });
    deleteIngestion(id, displayName)
      .then(() => {
        setTimeout(() => {
          setDeleteSelection({ id, name: displayName, state: 'success' });
          handleCancelConfirmationModal();
        }, 500);
      })
      .catch(() => {
        handleCancelConfirmationModal();
      });
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
    handleIngestionDataChange && handleIngestionDataChange(data);
  };

  const showAddIngestionButton = useMemo(
    () =>
      isRequiredDetailsAvailable &&
      permissions.EditAll &&
      displayAddIngestionButton,
    [isRequiredDetailsAvailable, permissions, displayAddIngestionButton]
  );

  useEffect(() => {
    getSearchedIngestions();
  }, [searchText, ingestionList]);

  useEffect(() => {
    fetchServicePermission();
  }, []);

  const getIngestionTab = () => {
    return (
      <div
        className={classNames('mt-4', containerClassName ?? '')}
        data-testid="ingestion-details-container">
        <div className="d-flex">
          {!isRequiredDetailsAvailable && (
            <div className="tw-rounded tw-bg-error-lite tw-text-error tw-font-medium tw-px-4 tw-py-1 tw-mb-4 tw-flex tw-items-center tw-gap-1">
              <ExclamationCircleOutlined />
              <p>
                {t('message.no-service-connection-details-message', {
                  serviceName,
                })}
              </p>
            </div>
          )}
        </div>
        <div className="tw-flex tw-justify-between">
          <div className="tw-w-4/12">
            {searchText || !isEmpty(ingestionData) ? (
              <Searchbar
                placeholder={`${t('message.search-for-ingestion')}...`}
                searchValue={searchText}
                typingInterval={500}
                onSearch={handleSearchAction}
              />
            ) : null}
          </div>
          <div className="tw-relative">
            {showAddIngestionButton && (
              <AddIngestionButton
                ingestionData={ingestionData}
                ingestionList={ingestionList}
                permissions={permissions}
                pipelineType={pipelineType}
                serviceCategory={serviceCategory}
                serviceDetails={serviceDetails}
                serviceName={serviceName}
              />
            )}
          </div>
        </div>
        <IngestionListTable
          airflowEndpoint={airflowEndpoint}
          deleteSelection={deleteSelection}
          deployIngestion={deployIngestion}
          handleDeleteSelection={handleDeleteSelection}
          handleEnableDisableIngestion={handleEnableDisableIngestion}
          handleIsConfirmationModalOpen={handleIsConfirmationModalOpen}
          ingestionData={ingestionData}
          isRequiredDetailsAvailable={isRequiredDetailsAvailable}
          paging={paging}
          permissions={permissions}
          pipelineNameColWidth={pipelineNameColWidth}
          serviceCategory={serviceCategory}
          serviceName={serviceName}
          servicePermission={servicePermission}
          triggerIngestion={triggerIngestion}
          onIngestionWorkflowsUpdate={onIngestionWorkflowsUpdate}
        />
      </div>
    );
  };

  return (
    <div data-testid="ingestion-container">
      {getIngestionTab()}
      <EntityDeleteModal
        entityName={deleteSelection.name}
        entityType={t('label.ingestion-lowercase')}
        loadingState={deleteSelection.state}
        visible={isConfirmationModalOpen}
        onCancel={handleCancelConfirmationModal}
        onConfirm={() => handleDelete(deleteSelection.id, deleteSelection.name)}
      />
    </div>
  );
};

export default Ingestion;
