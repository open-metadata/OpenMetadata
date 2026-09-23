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

import { Box, Tabs } from '@openmetadata/ui-core-components';
import { Card, Divider, Space, Typography } from 'antd';
import classNames from 'classnames';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { EntityField } from '../../../constants/Feeds.constants';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { ChangeDescription } from '../../../generated/entity/data/dashboard';
import { MlFeature } from '../../../generated/entity/data/mlmodel';
import { TagSource } from '../../../generated/type/tagLabel';
import { getRenderedActiveTab } from '../../../utils/CustomizePage/CustomizePageEntityTabUtils';
import {
  getCommonExtraInfoForVersionDetails,
  getEntityVersionByField,
  getEntityVersionTags,
} from '../../../utils/EntityVersionUtilsPure';
import { getMlFeatureVersionData } from '../../../utils/MlModelVersionUtils';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import { getVersionPath } from '../../../utils/RouterUtils';
import { getFilterTags } from '../../../utils/TableTags/TableTags.utils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import { CustomPropertyTable } from '../../common/CustomPropertyTable/CustomPropertyTable';
import Description from '../../common/EntityDescription/Description';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../common/Loader/Loader';
import RichTextEditorPreviewerV1 from '../../common/RichTextEditor/RichTextEditorPreviewerV1';
import TabsLabel from '../../common/TabsLabel/TabsLabel.component';
import { TabProps } from '../../common/TabsLabel/TabsLabel.interface';
import { GenericProvider } from '../../Customization/GenericProvider/GenericProvider';
import DataAssetsVersionHeader from '../../DataAssets/DataAssetsVersionHeader/DataAssetsVersionHeader';
import DataProductsContainer from '../../DataProducts/DataProductsContainer/DataProductsContainer.component';
import EntityVersionTimeLine from '../../Entity/EntityVersionTimeLine/EntityVersionTimeLine';
import TagsContainerV2 from '../../Tag/TagsContainerV2/TagsContainerV2';
import TagsViewer from '../../Tag/TagsViewer/TagsViewer';
import SourceList from '../MlModelDetail/SourceList.component';
import { MlModelVersionProp } from './MlModelVersion.interface';
const MlModelVersion: FC<MlModelVersionProp> = ({
  version,
  currentVersionData,
  isVersionLoading,
  owners,
  domains,
  dataProducts,
  tier,
  slashedMlModelName,
  versionList,
  deleted = false,
  backHandler,
  versionHandler,
  entityPermissions,
}: MlModelVersionProp) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tab } = useRequiredParams<{ tab: EntityTabs }>();

  const [changeDescription, setChangeDescription] = useState<ChangeDescription>(
    currentVersionData.changeDescription as ChangeDescription
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

  const mlFeaturesData = useMemo(
    () => getMlFeatureVersionData(currentVersionData, changeDescription),
    [currentVersionData, changeDescription]
  );

  const handleTabChange = useCallback(
    (activeKey: string) => {
      navigate(
        getVersionPath(
          EntityType.MLMODEL,
          currentVersionData.fullyQualifiedName ?? '',
          String(version),
          activeKey
        )
      );
    },
    [currentVersionData, version]
  );

  useEffect(() => {
    setChangeDescription(
      currentVersionData.changeDescription as ChangeDescription
    );
  }, [currentVersionData]);

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

  const viewCustomPropertiesPermission = useMemo(
    () => getDerivedPermissionFlags(entityPermissions).canViewCustomFields,
    [entityPermissions]
  );

  const tabItems: TabProps[] = useMemo(
    () => [
      {
        key: EntityTabs.FEATURES,
        label: (
          <TabsLabel
            id={EntityTabs.FEATURES}
            name={t('label.feature-plural')}
          />
        ),
        children: (
          <Box className="h-full">
            <div className="p-t-sm m-x-lg tw:min-w-0 tw:flex-auto">
              <Box direction="col" gap={4}>
                <div>
                  <Description
                    description={description}
                    entityType={EntityType.PIPELINE}
                    showActions={false}
                  />
                </div>
                <div>
                  {currentVersionData.mlFeatures?.length ? (
                    <Box data-testid="feature-list" direction="col">
                      <div>
                        <Divider className="m-y-md" />
                      </div>
                      <div>
                        <Typography.Title level={5}>
                          {t('label.feature-plural-used')}
                        </Typography.Title>
                      </div>

                      {mlFeaturesData?.map((feature: MlFeature) => (
                        <div key={feature.fullyQualifiedName}>
                          <Card
                            bordered
                            className="m-b-xlg"
                            data-testid={`feature-card-${feature.name ?? ''}`}
                            key={feature.fullyQualifiedName}>
                            <Box direction="col">
                              <div className="m-b-xs">
                                <Typography.Text className="font-semibold">
                                  {feature.name}
                                </Typography.Text>
                              </div>
                              <div className="m-b-xs">
                                <Space align="start">
                                  <Space>
                                    <Typography.Text className="text-grey-muted">
                                      {`${t('label.type')}:`}
                                    </Typography.Text>{' '}
                                    <Typography.Text>
                                      {feature.dataType || '--'}
                                    </Typography.Text>
                                  </Space>
                                  <Divider
                                    className="border-gray"
                                    type="vertical"
                                  />
                                  <Space>
                                    <Typography.Text className="text-grey-muted">
                                      {`${t('label.algorithm')}:`}
                                    </Typography.Text>{' '}
                                    <Typography.Text>
                                      {feature.featureAlgorithm || '--'}
                                    </Typography.Text>
                                  </Space>
                                </Space>
                              </div>
                              <div className="m-b-xs">
                                <Box gap={2}>
                                  <div className="tw:flex-[0_0_130px]">
                                    <Typography.Text className="text-grey-muted">
                                      {`${t('label.glossary-term-plural')} :`}
                                    </Typography.Text>
                                  </div>

                                  <div className="tw:min-w-0 tw:flex-auto">
                                    <TagsViewer
                                      sizeCap={-1}
                                      tags={
                                        getFilterTags(feature.tags ?? [])
                                          .Glossary
                                      }
                                    />
                                  </div>
                                </Box>
                              </div>

                              <div className="m-b-xs">
                                <Box gap={2}>
                                  <div className="tw:flex-[0_0_130px]">
                                    <Typography.Text className="text-grey-muted">
                                      {`${t('label.tag-plural')} :`}
                                    </Typography.Text>
                                  </div>
                                  <div className="tw:min-w-0 tw:flex-auto">
                                    <TagsViewer
                                      sizeCap={-1}
                                      tags={
                                        getFilterTags(feature.tags ?? [])
                                          .Classification
                                      }
                                    />
                                  </div>
                                </Box>
                              </div>

                              <div className="m-b-xs">
                                <Box gap={2}>
                                  <div className="tw:flex-[0_0_120px]">
                                    <Typography.Text className="text-grey-muted">
                                      {`${t('label.description')} :`}
                                    </Typography.Text>
                                  </div>
                                  <div className="tw:min-w-0 tw:flex-auto">
                                    <Space align="start">
                                      {feature.description ? (
                                        <RichTextEditorPreviewerV1
                                          enableSeeMoreVariant={false}
                                          markdown={feature.description}
                                        />
                                      ) : (
                                        <Typography.Text className="text-grey-muted">
                                          {t('label.no-entity', {
                                            entity: t('label.description'),
                                          })}
                                        </Typography.Text>
                                      )}
                                    </Space>
                                  </div>
                                </Box>
                              </div>

                              <div>
                                <SourceList feature={feature} />
                              </div>
                            </Box>
                          </Card>
                        </div>
                      ))}
                    </Box>
                  ) : (
                    <ErrorPlaceHolder />
                  )}
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
                    entityType={EntityType.MLMODEL}
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
            entityType={EntityType.MLMODEL}
            hasEditAccess={false}
            hasPermission={viewCustomPropertiesPermission}
          />
        ),
      },
    ],
    [
      description,
      mlFeaturesData,
      currentVersionData,
      viewCustomPropertiesPermission,
    ]
  );

  return (
    <>
      {isVersionLoading ? (
        <Loader />
      ) : (
        <div className={classNames('version-data')} data-testid="version-data">
          <Box direction="col" gap={3}>
            <div>
              <DataAssetsVersionHeader
                breadcrumbLinks={slashedMlModelName}
                currentVersionData={currentVersionData}
                deleted={deleted}
                displayName={displayName}
                domainDisplayName={domainDisplayName}
                entityType={EntityType.MLMODEL}
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
              type={EntityType.MLMODEL}
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
        currentVersion={version ?? ''}
        entityType={EntityType.MLMODEL}
        versionHandler={versionHandler}
        versionList={versionList}
        onBack={backHandler}
      />
    </>
  );
};

export default MlModelVersion;
