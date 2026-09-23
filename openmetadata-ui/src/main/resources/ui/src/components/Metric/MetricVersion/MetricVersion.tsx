/*
 *  Copyright 2024 Collate.
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
import { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { ChangeDescription } from '../../../generated/entity/data/metric';
import { TagSource } from '../../../generated/type/tagLabel';
import { getRenderedActiveTab } from '../../../utils/CustomizePage/CustomizePageEntityTabUtils';
import {
    getCommonExtraInfoForVersionDetails,
    getEntityVersionByField,
    getEntityVersionTags
} from '../../../utils/EntityVersionUtilsPure';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import { getVersionPath } from '../../../utils/RouterUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import { CustomPropertyTable } from '../../common/CustomPropertyTable/CustomPropertyTable';
import Description from '../../common/EntityDescription/Description';
import Loader from '../../common/Loader/Loader';
import TabsLabel from '../../common/TabsLabel/TabsLabel.component';
import { TabProps } from '../../common/TabsLabel/TabsLabel.interface';
import { TitleLink } from '../../common/TitleBreadcrumb/TitleBreadcrumb.interface';
import { GenericProvider } from '../../Customization/GenericProvider/GenericProvider';
import DataAssetsVersionHeader from '../../DataAssets/DataAssetsVersionHeader/DataAssetsVersionHeader';
import DataProductsContainer from '../../DataProducts/DataProductsContainer/DataProductsContainer.component';
import EntityVersionTimeLine from '../../Entity/EntityVersionTimeLine/EntityVersionTimeLine';
import TagsContainerV2 from '../../Tag/TagsContainerV2/TagsContainerV2';
import MetricDefinitionCard from '../MetricDefinitionCard/MetricDefinitionCard';
import { MetricVersionProp } from './MetricVersion.interface';

const MetricVersion: FC<MetricVersionProp> = ({
  version,
  currentVersionData,
  isVersionLoading,
  owners,
  domains,
  tier,
  slashedMetricName,
  versionList,
  backHandler,
  versionHandler,
  entityPermissions,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tab } = useRequiredParams<{ tab: EntityTabs }>();
  const [changeDescription, setChangeDescription] = useState<ChangeDescription>(
    currentVersionData.changeDescription as ChangeDescription
  );

  useEffect(() => {
    setChangeDescription(
      currentVersionData.changeDescription as ChangeDescription
    );
  }, [currentVersionData]);

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

  const tags = useMemo(
    () => getEntityVersionTags(currentVersionData, changeDescription),
    [currentVersionData, changeDescription]
  );

  const description = useMemo(
    () =>
      getEntityVersionByField(
        changeDescription,
        'description',
        currentVersionData.description
      ),
    [currentVersionData, changeDescription]
  );

  const displayName = useMemo(
    () =>
      getEntityVersionByField(
        changeDescription,
        'displayName',
        currentVersionData.displayName
      ),
    [currentVersionData, changeDescription]
  );

  const viewCustomPropertiesPermission = useMemo(
    () => getDerivedPermissionFlags(entityPermissions).canViewCustomFields,
    [entityPermissions]
  );

  const handleTabChange = (activeKey: string) => {
    navigate(
      getVersionPath(
        EntityType.METRIC,
        currentVersionData.fullyQualifiedName ?? '',
        String(version),
        activeKey
      )
    );
  };

  const tabItems: TabProps[] = useMemo(
    () => [
      {
        key: EntityTabs.OVERVIEW,
        label: (
          <TabsLabel id={EntityTabs.OVERVIEW} name={t('label.overview')} />
        ),
        children: (
          <Box className="h-full">
            <div className="p-t-sm m-x-lg tw:min-w-0 tw:flex-auto">
              <Box direction="col" gap={4}>
                <div>
                  <Description
                    description={description}
                    entityType={EntityType.METRIC}
                    showActions={false}
                  />
                </div>
                <div>
                  <MetricDefinitionCard
                    changeDescription={changeDescription}
                    metric={currentVersionData}
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
                  dataProducts={currentVersionData.dataProducts ?? []}
                  hasPermission={false}
                />
                {Object.keys(TagSource).map((tagType) => (
                  <TagsContainerV2
                    newLook
                    entityType={EntityType.METRIC}
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
            entityType={EntityType.METRIC}
            hasEditAccess={false}
            hasPermission={viewCustomPropertiesPermission}
          />
        ),
      },
    ],
    [
      changeDescription,
      currentVersionData,
      description,
      tags,
      domains,
      t,
      viewCustomPropertiesPermission,
    ]
  );

  if (isVersionLoading) {
    return <Loader />;
  }

  return (
    <>
      <div className="version-data">
        <Box direction="col" gap={3}>
          <div>
            <DataAssetsVersionHeader
              breadcrumbLinks={slashedMetricName as unknown as TitleLink[]}
              currentVersionData={currentVersionData}
              deleted={Boolean(currentVersionData.deleted)}
              displayName={displayName}
              domainDisplayName={domainDisplayName}
              entityType={EntityType.METRIC}
              ownerDisplayName={ownerDisplayName}
              ownerRef={ownerRef}
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
            type={EntityType.METRIC}
            onUpdate={() => Promise.resolve()}>
            <div className="entity-version-page-tabs">
              <Tabs
                className="tw:gap-3"
                data-testid="tabs"
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

      <EntityVersionTimeLine
        currentVersion={version ?? ''}
        entityType={EntityType.METRIC}
        versionHandler={versionHandler}
        versionList={versionList}
        onBack={backHandler}
      />
    </>
  );
};

export default MetricVersion;
