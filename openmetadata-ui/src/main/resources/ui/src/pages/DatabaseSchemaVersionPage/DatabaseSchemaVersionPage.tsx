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

import { Col, Row, Space, Tabs, TabsProps } from 'antd';
import classNames from 'classnames';
import { isEmpty, toString } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CustomPropertyTable } from '../../components/common/CustomPropertyTable/CustomPropertyTable';
import DescriptionV1 from '../../components/common/EntityDescription/DescriptionV1';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import TabsLabel from '../../components/common/TabsLabel/TabsLabel.component';
import { GenericProvider } from '../../components/Customization/GenericProvider/GenericProvider';
import DataAssetsVersionHeader from '../../components/DataAssets/DataAssetsVersionHeader/DataAssetsVersionHeader';
import DataProductsContainer from '../../components/DataProducts/DataProductsContainer/DataProductsContainer.component';
import EntityVersionTimeLine from '../../components/Entity/EntityVersionTimeLine/EntityVersionTimeLine';
import TagsContainerV2 from '../../components/Tag/TagsContainerV2/TagsContainerV2';
import { DisplayType } from '../../components/Tag/TagsViewer/TagsViewer.interface';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { DatabaseSchema } from '../../generated/entity/data/databaseSchema';
import { Table } from '../../generated/entity/data/table';
import { ChangeDescription } from '../../generated/entity/type';
import { EntityHistory } from '../../generated/type/entityHistory';
import { Include } from '../../generated/type/include';
import { TagSource } from '../../generated/type/tagLabel';
import { usePaging } from '../../hooks/paging/usePaging';
import { useFqn } from '../../hooks/useFqn';
import SchemaTablesTab from '../../pages/DatabaseSchemaPage/SchemaTablesTab';
import {
  getDatabaseSchemaDetailsByFQN,
  getDatabaseSchemaVersionData,
  getDatabaseSchemaVersions,
} from '../../rest/databaseAPI';
import { getTableList, TableListParams } from '../../rest/tableAPI';
import {
  getBasicEntityInfoFromVersionData,
  getCommonDiffsFromVersionData,
  getCommonExtraInfoForVersionDetails,
} from '../../utils/EntityVersionUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getEntityDetailsPath, getVersionPath } from '../../utils/RouterUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';

function DatabaseSchemaVersionPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { version, tab } = useRequiredParams<{
    version: string;
    tab: EntityTabs;
  }>();
  const { fqn: decodedEntityFQN } = useFqn();

  const pagingInfo = usePaging();

  const {
    paging,
    pageSize,
    handlePagingChange,
    handlePageChange,
    currentPage,
  } = pagingInfo;

  const [tableData, setTableData] = useState<Array<Table>>([]);
  const [servicePermissions, setServicePermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isVersionDataLoading, setIsVersionDataLoading] =
    useState<boolean>(true);
  const [isTableDataLoading, setIsTableDataLoading] = useState<boolean>(true);
  const [databaseId, setDatabaseId] = useState<string>('');
  const [currentVersionData, setCurrentVersionData] = useState<DatabaseSchema>(
    {} as DatabaseSchema
  );
  const [versionList, setVersionList] = useState<EntityHistory>(
    {} as EntityHistory
  );

  const viewVersionPermission = useMemo(
    () => servicePermissions.ViewAll || servicePermissions.ViewBasic,
    [servicePermissions]
  );

  const { tier, owners, breadcrumbLinks, changeDescription, deleted, domain } =
    useMemo(
      () =>
        getBasicEntityInfoFromVersionData(
          currentVersionData,
          EntityType.DATABASE_SCHEMA
        ),
      [currentVersionData]
    );

  const { ownerDisplayName, ownerRef, tierDisplayName, domainDisplayName } =
    useMemo(
      () =>
        getCommonExtraInfoForVersionDetails(
          currentVersionData.changeDescription as ChangeDescription,
          owners,
          tier,
          domain
        ),
      [currentVersionData.changeDescription, owners, tier, domain]
    );

  const fetchResourcePermission = useCallback(async () => {
    try {
      setIsLoading(true);
      const permission = await getEntityPermissionByFqn(
        ResourceEntity.DATABASE,
        decodedEntityFQN
      );

      setServicePermissions(permission);
    } finally {
      setIsLoading(false);
    }
  }, [decodedEntityFQN, getEntityPermissionByFqn, setServicePermissions]);

  const fetchVersionsList = useCallback(async () => {
    try {
      setIsLoading(true);

      const { id } = await getDatabaseSchemaDetailsByFQN(decodedEntityFQN, {
        include: Include.All,
      });
      setDatabaseId(id ?? '');

      const versions = await getDatabaseSchemaVersions(id ?? '');

      setVersionList(versions);
    } finally {
      setIsLoading(false);
    }
  }, [viewVersionPermission, decodedEntityFQN]);

  const fetchCurrentVersionData = useCallback(
    async (id: string) => {
      try {
        setIsVersionDataLoading(true);
        if (viewVersionPermission) {
          const response = await getDatabaseSchemaVersionData(id, version);

          setCurrentVersionData(response);
        }
      } finally {
        setIsVersionDataLoading(false);
      }
    },
    [viewVersionPermission, version]
  );

  const getSchemaTables = useCallback(
    async (params?: TableListParams) => {
      setIsTableDataLoading(true);
      try {
        const res = await getTableList({
          ...params,
          databaseSchema: decodedEntityFQN,
        });
        setTableData(res.data);
        handlePagingChange(res.paging);
      } finally {
        setIsTableDataLoading(false);
      }
    },
    [decodedEntityFQN]
  );

  const { displayName, tags, description } = useMemo(
    () => getCommonDiffsFromVersionData(currentVersionData, changeDescription),
    [currentVersionData, changeDescription]
  );

  const tablePaginationHandler = useCallback(
    ({ cursorType, currentPage }: PagingHandlerParams) => {
      if (cursorType) {
        getSchemaTables({ [cursorType]: paging[cursorType] });
      }
      handlePageChange(currentPage);
    },
    [paging, getSchemaTables]
  );

  const { versionHandler, backHandler } = useMemo(
    () => ({
      versionHandler: (newVersion = version) => {
        navigate(
          getVersionPath(
            EntityType.DATABASE_SCHEMA,
            decodedEntityFQN,
            newVersion,
            tab
          )
        );
      },
      backHandler: () => {
        navigate(
          getEntityDetailsPath(
            EntityType.DATABASE_SCHEMA,
            decodedEntityFQN,
            tab
          )
        );
      },
    }),
    [decodedEntityFQN, decodedEntityFQN, tab]
  );

  const handleTabChange = (activeKey: string) => {
    navigate(
      getVersionPath(
        EntityType.DATABASE_SCHEMA,
        decodedEntityFQN,
        String(version),
        activeKey
      )
    );
  };

  const tabs: TabsProps['items'] = useMemo(
    () => [
      {
        label: (
          <TabsLabel id={EntityTabs.TABLE} name={t('label.table-plural')} />
        ),
        key: EntityTabs.TABLE,
        children: (
          <Row className="h-full" gutter={[0, 16]} wrap={false}>
            <Col className="p-t-sm m-x-lg" flex="auto">
              <Row gutter={[16, 16]}>
                <Col data-testid="description-container" span={24}>
                  <DescriptionV1
                    description={description}
                    entityType={EntityType.DATABASE_SCHEMA}
                    isDescriptionExpanded={isEmpty(tableData)}
                    showActions={false}
                  />
                </Col>
                <Col className="p-t-sm" flex="auto">
                  <SchemaTablesTab isVersionView />
                </Col>
              </Row>
            </Col>

            <Col
              className="entity-tag-right-panel-container"
              data-testid="entity-right-panel"
              flex="220px">
              <Space className="w-full" direction="vertical" size="large">
                <DataProductsContainer
                  newLook
                  activeDomain={domain}
                  dataProducts={currentVersionData.dataProducts ?? []}
                  hasPermission={false}
                />
                {Object.keys(TagSource).map((tagType) => (
                  <TagsContainerV2
                    newLook
                    displayType={DisplayType.READ_MORE}
                    entityType={EntityType.DATABASE_SCHEMA}
                    key={tagType}
                    permission={false}
                    selectedTags={tags}
                    showTaskHandler={false}
                    tagType={TagSource[tagType as TagSource]}
                  />
                ))}
              </Space>
            </Col>
          </Row>
        ),
      },

      {
        key: EntityTabs.CUSTOM_PROPERTIES,
        label: (
          <TabsLabel
            id={EntityTabs.CUSTOM_PROPERTIES}
            name={t('label.custom-property-plural')}
          />
        ),
        children: (
          <CustomPropertyTable
            isVersionView
            entityType={EntityType.DATABASE_SCHEMA}
            hasEditAccess={false}
            hasPermission={viewVersionPermission}
          />
        ),
      },
    ],
    [
      currentPage,
      currentVersionData,
      description,
      tableData,
      isTableDataLoading,
      tablePaginationHandler,
      tags,
    ]
  );

  const versionComponent = useMemo(() => {
    if (isLoading) {
      return <Loader />;
    }

    if (!viewVersionPermission) {
      return (
        <ErrorPlaceHolder
          className="border-none"
          permissionValue={t('label.view-entity', {
            entity: t('label.database-schema-version'),
          })}
          type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
        />
      );
    }

    return (
      <>
        {isVersionDataLoading ? (
          <Loader />
        ) : (
          <div className={classNames('version-data')}>
            <Row gutter={[0, 12]}>
              <Col span={24}>
                <DataAssetsVersionHeader
                  breadcrumbLinks={breadcrumbLinks}
                  currentVersionData={currentVersionData}
                  deleted={deleted}
                  displayName={displayName}
                  domainDisplayName={domainDisplayName}
                  entityType={EntityType.DATABASE}
                  ownerDisplayName={ownerDisplayName}
                  ownerRef={ownerRef}
                  tierDisplayName={tierDisplayName}
                  version={version}
                  onVersionClick={backHandler}
                />
              </Col>
              <GenericProvider
                isVersionView
                currentVersionData={currentVersionData}
                data={currentVersionData}
                permissions={servicePermissions}
                type={EntityType.DATABASE}
                onUpdate={() => Promise.resolve()}>
                <Col className="entity-version-page-tabs" span={24}>
                  <Tabs
                    className="tabs-new"
                    data-testid="tabs"
                    defaultActiveKey={tab}
                    items={tabs}
                    onChange={handleTabChange}
                  />
                </Col>
              </GenericProvider>
            </Row>
          </div>
        )}

        <EntityVersionTimeLine
          currentVersion={toString(version)}
          entityType={EntityType.DATABASE_SCHEMA}
          versionHandler={versionHandler}
          versionList={versionList}
          onBack={backHandler}
        />
      </>
    );
  }, [
    isLoading,
    viewVersionPermission,
    isVersionDataLoading,
    breadcrumbLinks,
    currentVersionData,
    deleted,
    displayName,
    ownerDisplayName,
    ownerRef,
    tierDisplayName,
    version,
    backHandler,
    tabs,
    versionHandler,
    versionList,
    domainDisplayName,
  ]);

  useEffect(() => {
    if (!isEmpty(decodedEntityFQN)) {
      fetchResourcePermission();
    }
  }, [decodedEntityFQN]);

  useEffect(() => {
    if (viewVersionPermission) {
      fetchVersionsList();
    }
  }, [decodedEntityFQN, viewVersionPermission]);

  useEffect(() => {
    if (databaseId) {
      fetchCurrentVersionData(databaseId);
    }
  }, [version, databaseId]);

  useEffect(() => {
    if (!isEmpty(currentVersionData)) {
      getSchemaTables({ limit: pageSize });
    }
  }, [currentVersionData, pageSize]);

  return versionComponent;
}

export default DatabaseSchemaVersionPage;
