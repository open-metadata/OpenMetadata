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
import { isEmpty, toString } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { CustomPropertyTable } from '../../components/common/CustomPropertyTable/CustomPropertyTable';
import DescriptionV1 from '../../components/common/EntityDescription/DescriptionV1';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import DataAssetsVersionHeader from '../../components/DataAssets/DataAssetsVersionHeader/DataAssetsVersionHeader';
import { DatabaseSchemaTable } from '../../components/Database/DatabaseSchema/DatabaseSchemaTable/DatabaseSchemaTable';
import DataProductsContainer from '../../components/DataProductsContainer/DataProductsContainer.component';
import EntityVersionTimeLine from '../../components/Entity/EntityVersionTimeLine/EntityVersionTimeLine';
import Loader from '../../components/Loader/Loader';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { usePermissionProvider } from '../../components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../components/PermissionProvider/PermissionProvider.interface';
import TabsLabel from '../../components/TabsLabel/TabsLabel.component';
import TagsContainerV2 from '../../components/Tag/TagsContainerV2/TagsContainerV2';
import { DisplayType } from '../../components/Tag/TagsViewer/TagsViewer.interface';
import {
  getDatabaseDetailsPath,
  getVersionPathWithTab,
} from '../../constants/constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { Database } from '../../generated/entity/data/database';
import { ChangeDescription } from '../../generated/entity/type';
import { EntityHistory } from '../../generated/type/entityHistory';
import { TagSource } from '../../generated/type/tagLabel';
import {
  getDatabaseDetailsByFQN,
  getDatabaseVersionData,
  getDatabaseVersions,
} from '../../rest/databaseAPI';
import { getEntityName } from '../../utils/EntityUtils';
import {
  getBasicEntityInfoFromVersionData,
  getCommonDiffsFromVersionData,
  getCommonExtraInfoForVersionDetails,
} from '../../utils/EntityVersionUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getDecodedFqn } from '../../utils/StringsUtils';

function DatabaseVersionPage() {
  const { t } = useTranslation();
  const history = useHistory();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const {
    fqn: databaseFQN,
    version,
    tab,
  } = useParams<{
    fqn: string;
    version: string;
    tab: EntityTabs;
  }>();

  const [servicePermissions, setServicePermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isVersionDataLoading, setIsVersionDataLoading] =
    useState<boolean>(true);

  const [databaseId, setDatabaseId] = useState<string>('');
  const [currentVersionData, setCurrentVersionData] = useState<Database>(
    {} as Database
  );
  const [versionList, setVersionList] = useState<EntityHistory>(
    {} as EntityHistory
  );

  const { tier, owner, breadcrumbLinks, changeDescription, deleted, domain } =
    useMemo(
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

  const decodedEntityFQN = useMemo(
    () => getDecodedFqn(databaseFQN),
    [databaseFQN]
  );

  const { ownerDisplayName, ownerRef, tierDisplayName, domainDisplayName } =
    useMemo(
      () =>
        getCommonExtraInfoForVersionDetails(
          currentVersionData.changeDescription as ChangeDescription,
          owner,
          tier,
          domain
        ),
      [currentVersionData.changeDescription, owner, tier, domain]
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

  const { versionHandler, backHandler } = useMemo(
    () => ({
      versionHandler: (newVersion = version) => {
        history.push(
          getVersionPathWithTab(
            EntityType.DATABASE,
            databaseFQN,
            newVersion,
            tab
          )
        );
      },
      backHandler: () => {
        history.push(getDatabaseDetailsPath(decodedEntityFQN));
      },
    }),
    [databaseFQN, decodedEntityFQN, tab]
  );

  const handleTabChange = (activeKey: string) => {
    history.push(
      getVersionPathWithTab(
        EntityType.DATABASE,
        databaseFQN,
        String(version),
        activeKey
      )
    );
  };

  const { displayName, tags, description } = useMemo(
    () => getCommonDiffsFromVersionData(currentVersionData, changeDescription),
    [currentVersionData, changeDescription]
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
                    description={description}
                    entityType={EntityType.DATABASE}
                    showActions={false}
                  />
                </Col>
                <Col span={24}>
                  <DatabaseSchemaTable />
                </Col>
              </Row>
            </Col>
            <Col
              className="entity-tag-right-panel-container"
              data-testid="entity-right-panel"
              flex="220px">
              <Space className="w-full" direction="vertical" size="large">
                <DataProductsContainer
                  activeDomain={domain}
                  dataProducts={currentVersionData.dataProducts ?? []}
                  hasPermission={false}
                />
                {Object.keys(TagSource).map((tagType) => (
                  <TagsContainerV2
                    displayType={DisplayType.READ_MORE}
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
            entityDetails={currentVersionData}
            entityType={EntityType.DATABASE}
            hasEditAccess={false}
            hasPermission={viewVersionPermission}
          />
        ),
      },
    ],
    [tags, description]
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
                  domainDisplayName={domainDisplayName}
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
                  defaultActiveKey={tab ?? EntityTabs.SCHEMA}
                  items={tabs}
                  onChange={handleTabChange}
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
    domainDisplayName,
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
