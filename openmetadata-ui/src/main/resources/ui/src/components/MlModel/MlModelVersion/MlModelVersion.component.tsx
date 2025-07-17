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

import { RichTextEditorPreviewerV1 } from '@openmetadata/common-ui';
import {
  Card,
  Col,
  Divider,
  Row,
  Space,
  Tabs,
  TabsProps,
  Typography,
} from 'antd';
import classNames from 'classnames';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { EntityField } from '../../../constants/Feeds.constants';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { ChangeDescription } from '../../../generated/entity/data/dashboard';
import { MlFeature } from '../../../generated/entity/data/mlmodel';
import { TagSource } from '../../../generated/type/tagLabel';
import {
  getCommonExtraInfoForVersionDetails,
  getEntityVersionByField,
  getEntityVersionTags,
} from '../../../utils/EntityVersionUtils';
import { getMlFeatureVersionData } from '../../../utils/MlModelVersionUtils';
import { getVersionPath } from '../../../utils/RouterUtils';
import { getFilterTags } from '../../../utils/TableTags/TableTags.utils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import { CustomPropertyTable } from '../../common/CustomPropertyTable/CustomPropertyTable';
import DescriptionV1 from '../../common/EntityDescription/DescriptionV1';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../common/Loader/Loader';
import TabsLabel from '../../common/TabsLabel/TabsLabel.component';
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
  domain,
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
          domain
        ),
      [changeDescription, owners, tier, domain]
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

  const tabItems: TabsProps['items'] = useMemo(
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
          <Row className="h-full" gutter={[0, 16]} wrap={false}>
            <Col className="p-t-sm m-x-lg" flex="auto">
              <Row gutter={[0, 16]}>
                <Col span={24}>
                  <DescriptionV1
                    description={description}
                    entityType={EntityType.PIPELINE}
                    showActions={false}
                  />
                </Col>
                <Col span={24}>
                  {currentVersionData.mlFeatures?.length ? (
                    <Row data-testid="feature-list">
                      <Col span={24}>
                        <Divider className="m-y-md" />
                      </Col>
                      <Col span={24}>
                        <Typography.Title level={5}>
                          {t('label.feature-plural-used')}
                        </Typography.Title>
                      </Col>

                      {mlFeaturesData?.map((feature: MlFeature) => (
                        <Col key={feature.fullyQualifiedName} span={24}>
                          <Card
                            bordered
                            className="m-b-xlg"
                            data-testid={`feature-card-${feature.name ?? ''}`}
                            key={feature.fullyQualifiedName}>
                            <Row>
                              <Col className="m-b-xs" span={24}>
                                <Typography.Text className="font-semibold">
                                  {feature.name}
                                </Typography.Text>
                              </Col>
                              <Col className="m-b-xs" span={24}>
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
                              </Col>
                              <Col className="m-b-xs" span={24}>
                                <Row gutter={8} wrap={false}>
                                  <Col flex="130px">
                                    <Typography.Text className="text-grey-muted">
                                      {`${t('label.glossary-term-plural')} :`}
                                    </Typography.Text>
                                  </Col>

                                  <Col flex="auto">
                                    <TagsViewer
                                      sizeCap={-1}
                                      tags={
                                        getFilterTags(feature.tags ?? [])
                                          .Glossary
                                      }
                                    />
                                  </Col>
                                </Row>
                              </Col>

                              <Col className="m-b-xs" span={24}>
                                <Row gutter={8} wrap={false}>
                                  <Col flex="130px">
                                    <Typography.Text className="text-grey-muted">
                                      {`${t('label.tag-plural')} :`}
                                    </Typography.Text>
                                  </Col>
                                  <Col flex="auto">
                                    <TagsViewer
                                      sizeCap={-1}
                                      tags={
                                        getFilterTags(feature.tags ?? [])
                                          .Classification
                                      }
                                    />
                                  </Col>
                                </Row>
                              </Col>

                              <Col className="m-b-xs" span={24}>
                                <Row gutter={8} wrap={false}>
                                  <Col flex="120px">
                                    <Typography.Text className="text-grey-muted">
                                      {`${t('label.description')} :`}
                                    </Typography.Text>
                                  </Col>
                                  <Col flex="auto">
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
                                  </Col>
                                </Row>
                              </Col>

                              <Col span={24}>
                                <SourceList feature={feature} />
                              </Col>
                            </Row>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  ) : (
                    <ErrorPlaceHolder />
                  )}
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
            entityType={EntityType.MLMODEL}
            hasEditAccess={false}
            hasPermission={entityPermissions.ViewAll}
          />
        ),
      },
    ],
    [description, mlFeaturesData, currentVersionData, entityPermissions]
  );

  return (
    <>
      {isVersionLoading ? (
        <Loader />
      ) : (
        <div className={classNames('version-data')} data-testid="version-data">
          <Row gutter={[0, 12]}>
            <Col span={24}>
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
            </Col>
            <GenericProvider
              isVersionView
              currentVersionData={currentVersionData}
              data={currentVersionData}
              permissions={entityPermissions}
              type={EntityType.MLMODEL}
              onUpdate={() => Promise.resolve()}>
              <Col className="entity-version-page-tabs" span={24}>
                <Tabs
                  className="tabs-new"
                  defaultActiveKey={tab}
                  items={tabItems}
                  onChange={handleTabChange}
                />
              </Col>
            </GenericProvider>
          </Row>
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
