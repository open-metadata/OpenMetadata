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
import { Space } from 'antd';
import classNames from 'classnames';
import { cloneDeep, toString } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FQN_SEPARATOR_CHAR } from '../../../../constants/char.constants';
import { CustomizeEntityType } from '../../../../constants/Customize.constants';
import { EntityField } from '../../../../constants/Feeds.constants';
import { EntityTabs, EntityType, FqnPart } from '../../../../enums/entity.enum';
import {
  ChangeDescription,
  Column,
} from '../../../../generated/entity/data/worksheet';
import { TagSource } from '../../../../generated/type/tagLabel';
import { getRenderedActiveTab } from '../../../../utils/CustomizePage/CustomizePageEntityTabUtils';
import {
  getColumnsDataWithVersionChanges,
  getCommonExtraInfoForVersionDetails,
  getConstraintChanges,
  getEntityVersionByField,
  getEntityVersionTags,
} from '../../../../utils/EntityVersionUtilsPure';
import { getPartialNameFromTableFQN } from '../../../../utils/FqnUtils';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import { getVersionPath } from '../../../../utils/RouterUtils';
import { pruneEmptyChildren } from '../../../../utils/TablePureUtils';
import { useRequiredParams } from '../../../../utils/useRequiredParams';
import { CustomPropertyTable } from '../../../common/CustomPropertyTable/CustomPropertyTable';
import Description from '../../../common/EntityDescription/Description';
import Loader from '../../../common/Loader/Loader';
import TabsLabel from '../../../common/TabsLabel/TabsLabel.component';
import { TabProps } from '../../../common/TabsLabel/TabsLabel.interface';
import { GenericProvider } from '../../../Customization/GenericProvider/GenericProvider';
import DataAssetsVersionHeader from '../../../DataAssets/DataAssetsVersionHeader/DataAssetsVersionHeader';
import DataProductsContainer from '../../../DataProducts/DataProductsContainer/DataProductsContainer.component';
import EntityVersionTimeLine from '../../../Entity/EntityVersionTimeLine/EntityVersionTimeLine';
import VersionTable from '../../../Entity/VersionTable/VersionTable.component';
import TagsContainerV2 from '../../../Tag/TagsContainerV2/TagsContainerV2';
import { WorksheetVersionProps } from './WorksheetVersion.interface';
const WorksheetVersion = ({
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
}: Readonly<WorksheetVersionProps>) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tab } = useRequiredParams<{ tab: EntityTabs }>();
  const [changeDescription, setChangeDescription] = useState<ChangeDescription>(
    currentVersionData.changeDescription as ChangeDescription
  );

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
        EntityType.WORKSHEET,
        entityFqn,
        String(version),
        activeKey
      )
    );
  };

  useEffect(() => {
    setChangeDescription(
      currentVersionData.changeDescription as ChangeDescription
    );
  }, [currentVersionData]);

  const { tags, description, displayName, columns } = useMemo(() => {
    const colList = cloneDeep(
      pruneEmptyChildren(currentVersionData?.columns ?? [])
    );

    return {
      tags: getEntityVersionTags(currentVersionData, changeDescription),
      description: getEntityVersionByField(
        changeDescription,
        EntityField.DESCRIPTION,
        currentVersionData.description
      ),
      displayName: getEntityVersionByField(
        changeDescription,
        EntityField.DISPLAYNAME,
        currentVersionData.displayName
      ),
      columns: getColumnsDataWithVersionChanges<Column>(
        changeDescription,
        colList,
        true
      ),
    };
  }, [currentVersionData, changeDescription]);

  const {
    addedConstraintDiffs: addedColumnConstraintDiffs,
    deletedConstraintDiffs: deletedColumnConstraintDiffs,
  } = useMemo(
    () => getConstraintChanges(changeDescription, EntityField.CONSTRAINT),
    [changeDescription]
  );

  const viewCustomPropertiesPermission = useMemo(
    () => getDerivedPermissionFlags(entityPermissions).canViewCustomFields,
    [entityPermissions]
  );

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
                    entityType={EntityType.WORKSHEET}
                    showActions={false}
                  />
                </div>
                <div>
                  <VersionTable
                    addedColumnConstraintDiffs={addedColumnConstraintDiffs}
                    columnName={getPartialNameFromTableFQN(
                      entityFqn,
                      [FqnPart.Column],
                      FQN_SEPARATOR_CHAR
                    )}
                    columns={columns}
                    deletedColumnConstraintDiffs={deletedColumnConstraintDiffs}
                    joins={[]}
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
                    entityType={EntityType.WORKSHEET}
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
            entityType={EntityType.WORKSHEET}
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
    ]
  );

  return (
    <>
      {isVersionLoading ? (
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
                entityType={EntityType.WORKSHEET}
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
              type={EntityType.WORKSHEET as CustomizeEntityType}
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
        entityType={EntityType.WORKSHEET}
        versionHandler={versionHandler}
        versionList={versionList}
        onBack={backHandler}
      />
    </>
  );
};

export default WorksheetVersion;
