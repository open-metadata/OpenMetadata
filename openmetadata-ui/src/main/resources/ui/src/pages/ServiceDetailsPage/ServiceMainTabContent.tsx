/*
 *  Copyright 2023 Collate.
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

import { Col, Row, Space, Switch, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { isUndefined } from 'lodash';
import { EntityTags, ServiceTypes } from 'Models';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import DescriptionV1 from '../../components/common/EntityDescription/DescriptionV1';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import { NextPreviousProps } from '../../components/common/NextPrevious/NextPrevious.interface';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import Table from '../../components/common/Table/Table';
import { GenericProvider } from '../../components/Customization/GenericProvider/GenericProvider';
import EntityRightPanel from '../../components/Entity/EntityRightPanel/EntityRightPanel';
import { EntityName } from '../../components/Modals/EntityNameModal/EntityNameModal.interface';
import { CustomizeEntityType } from '../../constants/Customize.constants';
import { COMMON_RESIZABLE_PANEL_CONFIG } from '../../constants/ResizablePanel.constants';
import { TABLE_SCROLL_VALUE } from '../../constants/Table.constants';
import {
  COMMON_STATIC_TABLE_VISIBLE_COLUMNS,
  DEFAULT_SERVICE_TAB_VISIBLE_COLUMNS,
} from '../../constants/TableKeys.constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { OperationPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../enums/entity.enum';
import { DataProduct } from '../../generated/entity/domains/dataProduct';
import { Paging } from '../../generated/type/paging';
import { UsePagingInterface } from '../../hooks/paging/usePaging';
import { ServicesType } from '../../interface/service.interface';
import { getBulkEditButton } from '../../utils/EntityBulkEdit/EntityBulkEditUtils';
import { getEntityBulkEditPath } from '../../utils/EntityUtils';
import {
  callServicePatchAPI,
  getServiceMainTabColumns,
} from '../../utils/ServiceMainTabContentUtils';
import { getEntityTypeFromServiceCategory } from '../../utils/ServiceUtils';
import { getTagsWithoutTier, getTierTags } from '../../utils/TableUtils';
import { createTagObject } from '../../utils/TagsUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import { ServicePageData } from './ServiceDetailsPage.interface';

interface ServiceMainTabContentProps {
  serviceName: string;
  servicePermission: OperationPermission;
  serviceDetails: ServicesType;
  onDescriptionUpdate: (updatedHTML: string) => Promise<void>;
  showDeleted: boolean;
  onShowDeletedChange: (value: boolean) => void;
  data: ServicePageData[];
  isServiceLoading: boolean;
  paging: Paging;
  currentPage: number;
  pagingHandler: NextPreviousProps['pagingHandler'];
  saveUpdatedServiceData: (updatedData: ServicesType) => Promise<void>;
  pagingInfo: UsePagingInterface;
  isVersionPage?: boolean;
  onDataProductUpdate: (dataProducts: DataProduct[]) => Promise<void>;
}

function ServiceMainTabContent({
  serviceName,
  servicePermission,
  onDescriptionUpdate,
  showDeleted,
  onShowDeletedChange,
  data,
  isServiceLoading,
  paging,
  pagingHandler,
  currentPage,
  serviceDetails,
  saveUpdatedServiceData,
  pagingInfo,
  isVersionPage = false,
  onDataProductUpdate,
}: Readonly<ServiceMainTabContentProps>) {
  const { t } = useTranslation();
  const { serviceCategory } =
    useRequiredParams<{ serviceCategory: ServiceTypes }>();
  const { permissions } = usePermissionProvider();
  const navigate = useNavigate();
  const [pageData, setPageData] = useState<ServicePageData[]>([]);

  const tier = getTierTags(serviceDetails?.tags ?? []);
  const tags = getTagsWithoutTier(serviceDetails?.tags ?? []);

  /**
   * Formulates updated tags and updates table entity data for API call
   * @param selectedTags
   */
  const onTagUpdate = async (selectedTags?: Array<EntityTags>) => {
    if (selectedTags) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedTable = { ...serviceDetails, tags: updatedTags };
      await saveUpdatedServiceData(updatedTable);
    }
  };

  const handleTagSelection = async (selectedTags: EntityTags[]) => {
    if (selectedTags) {
      const prevTags =
        tags?.filter((tag) =>
          selectedTags
            .map((selTag) => selTag.tagFQN)
            .includes(tag?.tagFQN as string)
        ) || [];
      const newTags = createTagObject(
        selectedTags.filter((tag) => {
          return !prevTags
            ?.map((prevTag) => prevTag.tagFQN)
            .includes(tag.tagFQN);
        })
      );

      await onTagUpdate([...prevTags, ...newTags]);
    }
  };

  const handleDescriptionUpdate = useCallback(async (updatedHTML: string) => {
    try {
      await onDescriptionUpdate(updatedHTML);
    } catch {
      // Error
    }
  }, []);

  const handleDisplayNameUpdate = useCallback(
    async (entityData: EntityName, id?: string) => {
      try {
        const pageDataDetails = pageData.find((data) => data.id === id);
        if (!pageDataDetails) {
          return;
        }
        const updatedData = {
          ...pageDataDetails,
          displayName: entityData.displayName ?? undefined,
        };
        const jsonPatch = compare(pageDataDetails, updatedData);
        const response = await callServicePatchAPI(
          serviceCategory,
          pageDataDetails.id,
          jsonPatch
        );
        setPageData((prevData) =>
          prevData.map((data) => (data.id === id && response ? response : data))
        );
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [pageData, serviceCategory]
  );

  const editDisplayNamePermission = useMemo(() => {
    if (isVersionPage) {
      return false;
    }

    const servicePermissions = {
      databaseServices: permissions.databaseService,
      messagingServices: permissions.messagingService,
      dashboardServices: permissions.dashboardService,
      pipelineServices: permissions.pipelineService,
      mlmodelServices: permissions.mlmodelService,
      storageServices: permissions.storageService,
      searchServices: permissions.searchService,
      apiServices: permissions.apiService,
      driveServices: permissions.driveService,
    };

    const currentPermission =
      servicePermissions[serviceCategory as keyof typeof servicePermissions];

    return (
      currentPermission?.EditAll || currentPermission?.EditDisplayName || false
    );
  }, [permissions, serviceCategory, isVersionPage]);

  const tableColumn: ColumnsType<ServicePageData> = useMemo(
    () =>
      getServiceMainTabColumns(
        serviceCategory,
        editDisplayNamePermission,
        handleDisplayNameUpdate
      ),
    [serviceCategory, handleDisplayNameUpdate, editDisplayNamePermission]
  );

  const entityType = useMemo(
    () => getEntityTypeFromServiceCategory(serviceCategory),
    [serviceCategory]
  );

  const handleEditTable = () => {
    navigate({
      pathname: getEntityBulkEditPath(
        EntityType.DATABASE_SERVICE,
        serviceDetails.fullyQualifiedName ?? ''
      ),
    });
  };

  const {
    editTagsPermission,
    editGlossaryTermsPermission,
    editDescriptionPermission,
    editDataProductPermission,
  } = useMemo(
    () => ({
      editTagsPermission:
        (servicePermission.EditTags || servicePermission.EditAll) &&
        !serviceDetails.deleted,
      editGlossaryTermsPermission:
        (servicePermission.EditGlossaryTerms || servicePermission.EditAll) &&
        !serviceDetails.deleted,
      editDescriptionPermission:
        (servicePermission.EditDescription || servicePermission.EditAll) &&
        !serviceDetails.deleted,
      editDataProductPermission:
        servicePermission.EditAll && !serviceDetails.deleted,
    }),
    [servicePermission, serviceDetails]
  );

  useEffect(() => {
    setPageData(data);
  }, [data]);

  return (
    <Row className="main-tab-content" gutter={[0, 16]} wrap={false}>
      <Col className="tab-content-height-with-resizable-panel" span={24}>
        <ResizablePanels
          firstPanel={{
            className: 'entity-resizable-panel-container',
            children: (
              <Row gutter={[16, 16]}>
                <Col data-testid="description-container" span={24}>
                  <DescriptionV1
                    description={serviceDetails.description}
                    entityName={serviceName}
                    entityType={entityType}
                    hasEditAccess={editDescriptionPermission}
                    showActions={!serviceDetails.deleted}
                    showCommentsIcon={false}
                    onDescriptionUpdate={handleDescriptionUpdate}
                  />
                </Col>
                <Col data-testid="table-container" span={24}>
                  <Space
                    className="w-full m-b-md"
                    direction="vertical"
                    size="large">
                    {isServiceLoading ? (
                      <Loader />
                    ) : (
                      <Table
                        columns={tableColumn}
                        customPaginationProps={{
                          currentPage,
                          isLoading: isServiceLoading,
                          showPagination:
                            !isUndefined(pagingInfo) &&
                            pagingInfo.showPagination,
                          pageSize: pagingInfo.pageSize,
                          paging,

                          pagingHandler: pagingHandler,
                          onShowSizeChange: pagingInfo.handlePageSizeChange,
                        }}
                        data-testid="service-children-table"
                        dataSource={pageData}
                        defaultVisibleColumns={
                          DEFAULT_SERVICE_TAB_VISIBLE_COLUMNS
                        }
                        entityType={serviceCategory}
                        extraTableFilters={
                          <>
                            <span>
                              <Switch
                                checked={showDeleted}
                                data-testid="show-deleted"
                                onClick={onShowDeletedChange}
                              />
                              <Typography.Text className="m-l-xs">
                                {t('label.deleted')}
                              </Typography.Text>
                            </span>

                            {entityType === EntityType.DATABASE_SERVICE &&
                              getBulkEditButton(
                                servicePermission.EditAll &&
                                  !serviceDetails.deleted,
                                handleEditTable
                              )}
                          </>
                        }
                        locale={{
                          emptyText: <ErrorPlaceHolder className="m-y-md" />,
                        }}
                        pagination={false}
                        rowKey="id"
                        scroll={TABLE_SCROLL_VALUE}
                        size="small"
                        staticVisibleColumns={
                          COMMON_STATIC_TABLE_VISIBLE_COLUMNS
                        }
                      />
                    )}
                  </Space>
                </Col>
              </Row>
            ),
            ...COMMON_RESIZABLE_PANEL_CONFIG.LEFT_PANEL,
          }}
          secondPanel={{
            children: (
              <GenericProvider
                data={serviceDetails}
                permissions={servicePermission}
                type={entityType as CustomizeEntityType}
                onUpdate={saveUpdatedServiceData}>
                <div data-testid="entity-right-panel">
                  <EntityRightPanel
                    editDataProductPermission={editDataProductPermission}
                    editGlossaryTermsPermission={editGlossaryTermsPermission}
                    editTagPermission={editTagsPermission}
                    entityType={entityType}
                    selectedTags={tags}
                    showDataProductContainer={
                      entityType !== EntityType.METADATA_SERVICE
                    }
                    showTaskHandler={false}
                    onDataProductUpdate={onDataProductUpdate}
                    onTagSelectionChange={handleTagSelection}
                  />
                </div>
              </GenericProvider>
            ),
            ...COMMON_RESIZABLE_PANEL_CONFIG.RIGHT_PANEL,
            className:
              'entity-resizable-right-panel-container entity-resizable-panel-container',
          }}
        />
      </Col>
    </Row>
  );
}

export default ServiceMainTabContent;
