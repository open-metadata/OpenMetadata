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

import { Col, Row, Space, Tabs } from 'antd';
import classNames from 'classnames';
import DescriptionV1 from 'components/common/description/DescriptionV1';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import DataAssetsVersionHeader from 'components/DataAssets/DataAssetsVersionHeader/DataAssetsVersionHeader';
import EntityVersionTimeLine from 'components/Entity/EntityVersionTimeLine/EntityVersionTimeLine';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import TabsLabel from 'components/TabsLabel/TabsLabel.component';
import TagsContainerV2 from 'components/Tag/TagsContainerV2/TagsContainerV2';
import { DisplayType } from 'components/Tag/TagsViewer/TagsViewer.interface';
import {
  getDatabaseDetailsPath,
  INITIAL_PAGING_VALUE,
  pagingObject,
} from 'constants/constants';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { EntityTabs, EntityType } from 'enums/entity.enum';
import { Database } from 'generated/entity/data/database';
import { DatabaseSchema } from 'generated/entity/data/databaseSchema';
import { ChangeDescription } from 'generated/entity/type';
import { EntityHistory } from 'generated/type/entityHistory';
import { Paging } from 'generated/type/paging';
import { TagSource } from 'generated/type/tagLabel';
import { isEmpty, toString } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import {
  getDatabaseDetailsByFQN,
  getDatabaseSchemas,
  getDatabaseVersionData,
  getDatabaseVersions,
} from 'rest/databaseAPI';
import { getDatabseSchemaTable } from 'utils/DatabaseDetails.utils';
import { getEntityName } from 'utils/EntityUtils';
import {
  getBasicEntityInfoFromVersionData,
  getCommonDiffsFromVersionData,
  getCommonExtraInfoForVersionDetails,
} from 'utils/EntityVersionUtils';
import { DEFAULT_ENTITY_PERMISSION } from 'utils/PermissionsUtils';
import { getDatabaseVersionPath } from 'utils/RouterUtils';

function DatabaseVersionPage() {
  const { t } = useTranslation();
  const history = useHistory();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const { databaseFQN, version } = useParams<{
    databaseFQN: string;
    version: string;
  }>();
  const [paging, setPaging] = useState<Paging>(pagingObject);
  const [currentPage, setCurrentPage] = useState(INITIAL_PAGING_VALUE);
  const [schemaData, setSchemaData] = useState<DatabaseSchema[]>([]);
  const [servicePermissions, setServicePermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isVersionDataLoading, setIsVersionDataLoading] =
    useState<boolean>(true);
  const [isSchemaDataLoading, setIsSchemaDataLoading] = useState<boolean>(true);
  const [databaseId, setDatabaseId] = useState<string>('');
  const [currentVersionData, setCurrentVersionData] = useState<Database>(
    {} as Database
  );
  const [versionList, setVersionList] = useState<EntityHistory>(
    {} as EntityHistory
  );

  const { tier, owner, breadcrumbLinks, changeDescription, deleted } = useMemo(
    () =>
      getBasicEntityInfoFromVersionData(
        currentVersionData,
        EntityType.DATABASE
      ),
    [currentVersionData]
  );

  const viewVersionPermission = useMemo(
    () => servicePermissions.ViewAll || servicePermissions.ViewBasic,
    [servicePermissions]
  );

  const { ownerDisplayName, ownerRef, tierDisplayName } = useMemo(
    () =>
      getCommonExtraInfoForVersionDetails(
        currentVersionData.changeDescription as ChangeDescription,
        owner,
        tier
      ),
    [currentVersionData.changeDescription, owner, tier]
  );

  const fetchResourcePermission = useCallback(async () => {
    try {
      setIsLoading(true);
      const permission = await getEntityPermissionByFqn(
        ResourceEntity.DATABASE,
        databaseFQN
      );

      setServicePermissions(permission);
    } finally {
      setIsLoading(false);
    }
  }, [databaseFQN, getEntityPermissionByFqn, setServicePermissions]);

  const fetchVersionsList = useCallback(async () => {
    try {
      setIsLoading(true);

      const { id } = await getDatabaseDetailsByFQN(databaseFQN, '');
      setDatabaseId(id ?? '');

      const versions = await getDatabaseVersions(id ?? '');

      setVersionList(versions);
    } finally {
      setIsLoading(false);
    }
  }, [viewVersionPermission, databaseFQN]);

  const fetchCurrentVersionData = useCallback(
    async (id: string) => {
      try {
        setIsVersionDataLoading(true);
        if (viewVersionPermission) {
          const response = await getDatabaseVersionData(id, version);

          setCurrentVersionData(response);
        }
      } finally {
        setIsVersionDataLoading(false);
      }
    },
    [viewVersionPermission, version]
  );

  const fetchDatabaseSchemas = useCallback(
    async (pagingObj?: string) => {
      setIsSchemaDataLoading(true);
      try {
        const response = await getDatabaseSchemas(databaseFQN, pagingObj, [
          'owner',
          'usageSummary',
        ]);
        setSchemaData(response.data);
        setPaging(response.paging);
      } catch {
        setSchemaData([]);
        setPaging(pagingObject);
      } finally {
        setIsSchemaDataLoading(false);
      }
    },
    [databaseFQN]
  );

  const databaseSchemaPagingHandler = useCallback(
    (cursorType: string | number, activePage?: number) => {
      const pagingString = `&${cursorType}=${
        paging[cursorType as keyof typeof paging]
      }`;
      setIsSchemaDataLoading(true);
      fetchDatabaseSchemas(pagingString).finally(() => {
        setIsSchemaDataLoading(false);
      });
      setCurrentPage(activePage ?? 1);
    },
    [paging, fetchDatabaseSchemas]
  );

  const { versionHandler, backHandler } = useMemo(
    () => ({
      versionHandler: (newVersion = version) => {
        history.push(getDatabaseVersionPath(databaseFQN, toString(newVersion)));
      },
      backHandler: () => {
        history.push(getDatabaseDetailsPath(databaseFQN));
      },
    }),
    [databaseFQN]
  );

  const { displayName, tags, description } = useMemo(
    () => getCommonDiffsFromVersionData(currentVersionData, changeDescription),
    [currentVersionData, changeDescription]
  );

  const databaseTable = useMemo(
    () =>
      getDatabseSchemaTable(
        schemaData,
        isSchemaDataLoading,
        paging,
        currentPage,
        databaseSchemaPagingHandler
      ),
    [
      schemaData,
      isSchemaDataLoading,
      paging,
      currentPage,
      databaseSchemaPagingHandler,
    ]
  );

  const tabs = useMemo(
    () => [
      {
        label: (
          <TabsLabel id={EntityTabs.SCHEMA} name={t('label.schema-plural')} />
        ),
        key: EntityTabs.SCHEMA,
        children: (
          <Row gutter={[0, 16]} wrap={false}>
            <Col className="p-t-sm m-x-lg" flex="auto">
              <Row gutter={[16, 16]}>
                <Col data-testid="description-container" span={24}>
                  <DescriptionV1
                    isVersionView
                    description={description}
                    entityFqn={databaseFQN}
                    entityType={EntityType.DATABASE}
                  />
                </Col>
                {databaseTable}
              </Row>
            </Col>
            <Col
              className="entity-tag-right-panel-container"
              data-testid="entity-right-panel"
              flex="220px">
              <Space className="w-full" direction="vertical" size="large">
                {Object.keys(TagSource).map((tagType) => (
                  <TagsContainerV2
                    displayType={DisplayType.READ_MORE}
                    entityFqn={databaseFQN}
                    entityType={EntityType.DATABASE}
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
    ],
    [tags, description, databaseFQN, databaseTable]
  );

  const versionComponent = useMemo(() => {
    if (isLoading) {
      return <Loader />;
    }

    if (!viewVersionPermission) {
      return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
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
                  entityType={EntityType.DATABASE}
                  ownerDisplayName={ownerDisplayName}
                  ownerRef={ownerRef}
                  tierDisplayName={tierDisplayName}
                  version={version}
                  onVersionClick={backHandler}
                />
              </Col>
              <Col span={24}>
                <Tabs
                  className="entity-details-page-tabs"
                  data-testid="tabs"
                  items={tabs}
                />
              </Col>
            </Row>
          </div>
        )}

        <EntityVersionTimeLine
          currentVersion={toString(version)}
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
  ]);

  useEffect(() => {
    if (!isEmpty(databaseFQN)) {
      fetchResourcePermission();
    }
  }, [databaseFQN]);

  useEffect(() => {
    if (viewVersionPermission) {
      fetchVersionsList();
    }
  }, [databaseFQN, viewVersionPermission]);

  useEffect(() => {
    if (databaseId) {
      fetchCurrentVersionData(databaseId);
    }
  }, [version, databaseId]);

  useEffect(() => {
    if (!isEmpty(currentVersionData)) {
      fetchDatabaseSchemas();
    }
  }, [currentVersionData]);

  return (
    <PageLayoutV1
      className="version-page-container"
      pageTitle={t('label.entity-version-detail-plural', {
        entity: getEntityName(currentVersionData),
      })}>
      {versionComponent}
    </PageLayoutV1>
  );
}

export default DatabaseVersionPage;
