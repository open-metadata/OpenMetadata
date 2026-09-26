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

import { Box, Tabs } from '@openmetadata/ui-core-components';
import { Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { toString } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CustomizeEntityType } from '../../../../constants/Customize.constants';
import { EntityField } from '../../../../constants/Feeds.constants';
import { EntityTabs, EntityType } from '../../../../enums/entity.enum';
import {
  ChangeDescription,
  Directory,
  EntityReference,
} from '../../../../generated/entity/data/directory';
import { TagSource } from '../../../../generated/type/tagLabel';
import { useFqn } from '../../../../hooks/useFqn';
import { getDriveAssetByFqn } from '../../../../rest/driveAPI';
import { getRenderedActiveTab } from '../../../../utils/CustomizePage/CustomizePageEntityTabUtils';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import {
  getCommonExtraInfoForVersionDetails,
  getConstraintChanges,
  getEntityVersionByField,
  getEntityVersionTags,
} from '../../../../utils/EntityVersionUtilsPure';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import { getVersionPath } from '../../../../utils/RouterUtils';
import { descriptionTableObject } from '../../../../utils/TableColumn.util';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { useRequiredParams } from '../../../../utils/useRequiredParams';
import { CustomPropertyTable } from '../../../common/CustomPropertyTable/CustomPropertyTable';
import Description from '../../../common/EntityDescription/Description';
import Loader from '../../../common/Loader/Loader';
import { ColumnsType } from '../../../common/Table/Table.interface';
import Table from '../../../common/Table/TableV2';
import TabsLabel from '../../../common/TabsLabel/TabsLabel.component';
import { TabProps } from '../../../common/TabsLabel/TabsLabel.interface';
import { GenericProvider } from '../../../Customization/GenericProvider/GenericProvider';
import DataAssetsVersionHeader from '../../../DataAssets/DataAssetsVersionHeader/DataAssetsVersionHeader';
import DataProductsContainer from '../../../DataProducts/DataProductsContainer/DataProductsContainer.component';
import EntityVersionTimeLine from '../../../Entity/EntityVersionTimeLine/EntityVersionTimeLine';
import TagsContainerV2 from '../../../Tag/TagsContainerV2/TagsContainerV2';
import { DirectoryVersionProps } from './DirectoryVersion.interface';
const DirectoryVersion = ({
  version,
  currentVersionData,
  isVersionLoading,
  owners,
  domains,
  dataProducts,
  tier,
  breadCrumbList,
  versionList,
  deleted = false,
  backHandler,
  versionHandler,
  entityPermissions,
}: Readonly<DirectoryVersionProps>) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tab } = useRequiredParams<{ tab: EntityTabs }>();
  const { fqn: directoryFQN } = useFqn();
  const [changeDescription, setChangeDescription] = useState<ChangeDescription>(
    currentVersionData.changeDescription as ChangeDescription
  );
  const [directoryDetails, setDirectoryDetails] =
    useState<Directory>(currentVersionData);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const entityFqn = useMemo(
    () => currentVersionData.fullyQualifiedName ?? '',
    [currentVersionData.fullyQualifiedName ?? '']
  );

  const { ownerDisplayName, ownerRef, tierDisplayName, domainDisplayName } =
    useMemo(
      () =>
        getCommonExtraInfoForVersionDetails(
          changeDescription,
          owners,
          tier,
          domains
        ),
      [changeDescription, owners, tier, domains]
    );

  const handleTabChange = (activeKey: string) => {
    navigate(
      getVersionPath(
        EntityType.DIRECTORY,
        entityFqn,
        String(version),
        activeKey
      )
    );
  };

  const tags = useMemo(() => {
    return getEntityVersionTags(currentVersionData, changeDescription);
  }, [currentVersionData, changeDescription]);

  const description = useMemo(() => {
    return getEntityVersionByField(
      changeDescription,
      EntityField.DESCRIPTION,
      currentVersionData.description
    );
  }, [currentVersionData, changeDescription]);

  const displayName = useMemo(() => {
    return getEntityVersionByField(
      changeDescription,
      EntityField.DISPLAYNAME,
      currentVersionData.displayName
    );
  }, [currentVersionData, changeDescription]);

  const {
    addedConstraintDiffs: addedColumnConstraintDiffs,
    deletedConstraintDiffs: deletedColumnConstraintDiffs,
  } = useMemo(
    () => getConstraintChanges(changeDescription, EntityField.CONSTRAINT),
    [changeDescription]
  );

  const tableColumn: ColumnsType<EntityReference> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        render: (_, record) => (
          <Typography.Text>{getEntityName(record)}</Typography.Text>
        ),
      },
      {
        title: t('label.type'),
        dataIndex: 'type',
        key: 'type',
      },
      ...descriptionTableObject(),
    ],
    []
  );

  const viewCustomPropertiesPermission = useMemo(() => {
    return getDerivedPermissionFlags(entityPermissions).canViewCustomFields;
  }, [entityPermissions]);

  const tabItems: TabProps[] = useMemo(
    () => [
      {
        key: EntityTabs.SCHEMA,
        label: <TabsLabel id={EntityTabs.SCHEMA} name={t('label.schema')} />,
        children: (
          <Box className="h-full">
            <div className="p-t-sm m-x-lg tw:min-w-0 tw:flex-auto">
              <Box direction="col" gap={4}>
                <div>
                  <Description
                    description={description}
                    entityType={EntityType.DIRECTORY}
                    showActions={false}
                  />
                </div>
                <div>
                  <Table
                    columns={tableColumn}
                    data-testid="directory-children-table"
                    dataSource={directoryDetails.children}
                    pagination={false}
                    rowKey="name"
                    size="small"
                  />
                </div>
              </Box>
            </div>
            <div
              className="entity-tag-right-panel-container tw:flex-[0_0_220px]"
              data-testid="entity-right-panel">
              <Space className="w-full" direction="vertical" size="large">
                <DataProductsContainer
                  newLook
                  activeDomains={domains}
                  dataProducts={dataProducts ?? []}
                  hasPermission={false}
                />

                {Object.keys(TagSource).map((tagType) => (
                  <TagsContainerV2
                    newLook
                    entityType={EntityType.DIRECTORY}
                    key={tagType}
                    permission={false}
                    selectedTags={tags}
                    tagType={TagSource[tagType as TagSource]}
                  />
                ))}
              </Space>
            </div>
          </Box>
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
            entityType={EntityType.DIRECTORY}
            hasEditAccess={false}
            hasPermission={viewCustomPropertiesPermission}
          />
        ),
      },
    ],
    [
      description,
      entityFqn,
      currentVersionData,
      viewCustomPropertiesPermission,
      addedColumnConstraintDiffs,
      deletedColumnConstraintDiffs,
      directoryDetails,
    ]
  );

  const fetchDirectoryDetails = async (directoryFQN: string) => {
    setIsLoading(true);
    try {
      const res = await getDriveAssetByFqn<Directory>(
        directoryFQN,
        EntityType.DIRECTORY,
        'children'
      );
      const { children } = res;

      setDirectoryDetails((prev) => ({ ...prev, children }));
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-details-fetch-error', {
          entityType: t('label.directory'),
          entityName: directoryFQN,
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectoryDetails(directoryFQN);
  }, []);

  useEffect(() => {
    setChangeDescription(
      currentVersionData.changeDescription as ChangeDescription
    );
  }, [currentVersionData]);

  return (
    <>
      {isVersionLoading || isLoading ? (
        <Loader />
      ) : (
        <div className={classNames('version-data')}>
          <Box direction="col" gap={3}>
            <div>
              <DataAssetsVersionHeader
                breadcrumbLinks={breadCrumbList}
                currentVersionData={currentVersionData}
                deleted={deleted}
                displayName={displayName}
                domainDisplayName={domainDisplayName}
                entityType={EntityType.DIRECTORY}
                ownerDisplayName={ownerDisplayName}
                ownerRef={ownerRef}
                serviceName={currentVersionData.service?.name}
                tierDisplayName={tierDisplayName}
                version={version}
                onVersionClick={backHandler}
              />
            </div>
            <GenericProvider
              isVersionView
              currentVersionData={currentVersionData}
              data={currentVersionData}
              permissions={entityPermissions}
              type={EntityType.DIRECTORY as CustomizeEntityType}
              onUpdate={() => Promise.resolve()}>
              <div className="entity-version-page-tabs">
                <Tabs
                  className="tw:gap-3"
                  defaultSelectedKey={getRenderedActiveTab(tabItems, tab)}
                  onSelectionChange={(key) => handleTabChange(String(key))}>
                  <Tabs.List size="sm" type="underline" variant="card">
                    {tabItems.map(({ key, label }) => (
                      <Tabs.Item id={key} key={key}>
                        {label}
                      </Tabs.Item>
                    ))}
                  </Tabs.List>
                  {tabItems.map(({ key, children }) => (
                    <Tabs.Panel id={key} key={key}>
                      {children}
                    </Tabs.Panel>
                  ))}
                </Tabs>
              </div>
            </GenericProvider>
          </Box>
        </div>
      )}

      <EntityVersionTimeLine
        currentVersion={toString(version)}
        entityType={EntityType.DIRECTORY}
        versionHandler={versionHandler}
        versionList={versionList}
        onBack={backHandler}
      />
    </>
  );
};

export default DirectoryVersion;
