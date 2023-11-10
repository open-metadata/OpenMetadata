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
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { CustomPropertyTable } from '../../components/common/CustomPropertyTable/CustomPropertyTable';
import DescriptionV1 from '../../components/common/EntityDescription/DescriptionV1';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import RichTextEditorPreviewer from '../../components/common/RichTextEditor/RichTextEditorPreviewer';
import DataAssetsVersionHeader from '../../components/DataAssets/DataAssetsVersionHeader/DataAssetsVersionHeader';
import EntityVersionTimeLine from '../../components/Entity/EntityVersionTimeLine/EntityVersionTimeLine';
import SourceList from '../../components/MlModelDetail/SourceList.component';
import TabsLabel from '../../components/TabsLabel/TabsLabel.component';
import TagsContainerV2 from '../../components/Tag/TagsContainerV2/TagsContainerV2';
import TagsViewer from '../../components/Tag/TagsViewer/TagsViewer';
import { getVersionPathWithTab } from '../../constants/constants';
import { EntityField } from '../../constants/Feeds.constants';
import { EntityTabs, EntityType } from '../../enums/entity.enum';
import { ChangeDescription } from '../../generated/entity/data/dashboard';
import { MlFeature } from '../../generated/entity/data/mlmodel';
import { TagSource } from '../../generated/type/tagLabel';
import {
  getCommonExtraInfoForVersionDetails,
  getEntityVersionByField,
  getEntityVersionTags,
} from '../../utils/EntityVersionUtils';
import { getMlFeatureVersionData } from '../../utils/MlModelVersionUtils';
import { getEncodedFqn } from '../../utils/StringsUtils';
import { getFilterTags } from '../../utils/TableTags/TableTags.utils';
import DataProductsContainer from '../DataProductsContainer/DataProductsContainer.component';
import Loader from '../Loader/Loader';
import { MlModelVersionProp } from './MlModelVersion.interface';

const MlModelVersion: FC<MlModelVersionProp> = ({
  version,
  currentVersionData,
  isVersionLoading,
  owner,
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
  const history = useHistory();
  const { tab } = useParams<{ tab: EntityTabs }>();

  const [changeDescription, setChangeDescription] = useState<ChangeDescription>(
    currentVersionData.changeDescription as ChangeDescription
  );

  const { ownerDisplayName, ownerRef, tierDisplayName, domainDisplayName } =
    useMemo(
      () =>
        getCommonExtraInfoForVersionDetails(
          changeDescription,
          owner,
          tier,
          domain
        ),
      [changeDescription, owner, tier, domain]
    );

  const mlFeaturesData = useMemo(
    () => getMlFeatureVersionData(currentVersionData, changeDescription),
    [currentVersionData, changeDescription]
  );

  const handleTabChange = useCallback(
    (activeKey: string) => {
      history.push(
        getVersionPathWithTab(
          EntityType.MLMODEL,
          getEncodedFqn(currentVersionData.fullyQualifiedName ?? ''),
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
          <Row gutter={[0, 16]} wrap={false}>
            <Col className="p-t-sm m-x-lg" flex="auto">
              <Row gutter={[0, 16]}>
                <Col span={24}>
                  <DescriptionV1
                    isVersionView
                    description={description}
                    entityType={EntityType.PIPELINE}
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
                                        <RichTextEditorPreviewer
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
                  activeDomain={domain}
                  dataProducts={dataProducts ?? []}
                  hasPermission={false}
                />
                {Object.keys(TagSource).map((tagType) => (
                  <TagsContainerV2
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
            entityDetails={currentVersionData}
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
            <Col span={24}>
              <Tabs
                defaultActiveKey={tab ?? EntityTabs.FEATURES}
                items={tabItems}
                onChange={handleTabChange}
              />
            </Col>
          </Row>
        </div>
      )}

      <EntityVersionTimeLine
        currentVersion={version}
        versionHandler={versionHandler}
        versionList={versionList}
        onBack={backHandler}
      />
    </>
  );
};

export default MlModelVersion;
