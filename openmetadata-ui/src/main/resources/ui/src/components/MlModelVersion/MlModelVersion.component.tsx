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

import { Card, Col, Divider, Row, Space, Tabs, Typography } from 'antd';
import classNames from 'classnames';
import { CustomPropertyTable } from 'components/common/CustomPropertyTable/CustomPropertyTable';
import { CustomPropertyProps } from 'components/common/CustomPropertyTable/CustomPropertyTable.interface';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import SourceList from 'components/MlModelDetail/SourceList.component';
import TabsLabel from 'components/TabsLabel/TabsLabel.component';
import TagsViewer from 'components/Tag/TagsViewer/tags-viewer';
import {
  getDashboardDetailsPath,
  getVersionPathWithTab,
} from 'constants/constants';
import { EntityInfo, EntityTabs, EntityType } from 'enums/entity.enum';
import { MlFeature, Mlmodel } from 'generated/entity/data/mlmodel';
import { cloneDeep, isEqual, isUndefined } from 'lodash';
import React, { FC, Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { getEntityName } from 'utils/EntityUtils';
import { getFilterTags } from 'utils/TableTags/TableTags.utils';
import { EntityField } from '../../constants/Feeds.constants';
import { ChangeDescription } from '../../generated/entity/data/dashboard';
import { TagLabel } from '../../generated/type/tagLabel';
import {
  getChangedEntityName,
  getChangedEntityNewValue,
  getChangedEntityOldValue,
  getCommonExtraInfoForVersionDetails,
  getDescriptionDiff,
  getDiffByFieldName,
  getEntityVersionDescription,
  getEntityVersionTags,
  getTagsDiff,
  removeDuplicateTags,
} from '../../utils/EntityVersionUtils';
import { TagLabelWithStatus } from '../../utils/EntityVersionUtils.interface';
import Description from '../common/description/Description';
import EntityPageInfo from '../common/entityPageInfo/EntityPageInfo';
import EntityVersionTimeLine from '../EntityVersionTimeLine/EntityVersionTimeLine';
import Loader from '../Loader/Loader';
import { MlModelVersionProp } from './MlModelVersion.interface';

const MlModelVersion: FC<MlModelVersionProp> = ({
  version,
  currentVersionData,
  isVersionLoading,
  owner,
  tier,
  slashedMlModelName,
  versionList,
  deleted = false,
  backHandler,
  versionHandler,
}: MlModelVersionProp) => {
  const { t } = useTranslation();
  const history = useHistory();
  const { tab } = useParams<{ tab: EntityTabs }>();

  const [changeDescription, setChangeDescription] = useState<ChangeDescription>(
    currentVersionData.changeDescription as ChangeDescription
  );

  const extraInfo = useMemo(() => {
    const { algorithm, server, target, dashboard } =
      currentVersionData as Mlmodel;

    return [
      ...getCommonExtraInfoForVersionDetails(changeDescription, owner, tier),
      {
        key: EntityInfo.ALGORITHM,
        value: algorithm,
        showLabel: true,
      },
      {
        key: EntityInfo.TARGET,
        value: target,
        showLabel: true,
      },
      {
        key: EntityInfo.SERVER,
        value: server,
        showLabel: true,
        isLink: true,
      },
      ...(!isUndefined(dashboard)
        ? [
            {
              key: EntityInfo.DASHBOARD,
              value: getDashboardDetailsPath(
                dashboard?.fullyQualifiedName as string
              ),
              placeholderText: getEntityName(dashboard),
              showLabel: true,
              isLink: true,
            },
          ]
        : []),
    ];
  }, [currentVersionData, changeDescription, owner, tier]);

  const handleFeatureDescriptionChangeDiff = (
    colList: Mlmodel['mlFeatures'],
    oldDiff: MlFeature[],
    newDiff: MlFeature[]
  ) => {
    colList?.forEach((i) => {
      if (isEqual(i.name, newDiff[0]?.name)) {
        i.description = getDescriptionDiff(
          oldDiff[0]?.description ?? '',
          newDiff[0]?.description ?? ''
        );
      }
    });
  };

  const handleFeatureTagChangeDiff = (
    colList: Mlmodel['mlFeatures'],
    oldDiff: MlFeature[],
    newDiff: MlFeature[]
  ) => {
    colList?.forEach((i) => {
      if (isEqual(i.name, newDiff[0]?.name)) {
        const flag: { [x: string]: boolean } = {};
        const uniqueTags: Array<TagLabelWithStatus> = [];
        const oldTag = removeDuplicateTags(
          oldDiff[0].tags ?? [],
          newDiff[0].tags ?? []
        );
        const newTag = removeDuplicateTags(
          newDiff[0].tags ?? [],
          oldDiff[0].tags ?? []
        );
        const tagsDiff = getTagsDiff(oldTag, newTag);

        [...tagsDiff, ...((i.tags ?? []) as Array<TagLabelWithStatus>)].forEach(
          (elem: TagLabelWithStatus) => {
            if (!flag[elem.tagFQN]) {
              flag[elem.tagFQN] = true;
              uniqueTags.push(elem);
            }
          }
        );
        i.tags = uniqueTags;
      }
    });
  };

  const mlFeaturesData = useMemo((): Mlmodel['mlFeatures'] => {
    const colList = cloneDeep((currentVersionData as Mlmodel).mlFeatures ?? []);
    const columnsDiff = getDiffByFieldName(
      EntityField.ML_FEATURES,
      changeDescription
    );

    if (getChangedEntityName(columnsDiff) === EntityField.ML_FEATURES) {
      const oldDiff = JSON.parse(getChangedEntityOldValue(columnsDiff) ?? '[]');
      const newDiff = JSON.parse(getChangedEntityNewValue(columnsDiff) ?? '[]');

      handleFeatureDescriptionChangeDiff(colList, oldDiff, newDiff);

      handleFeatureTagChangeDiff(colList, oldDiff, newDiff);

      return colList;
    }

    return colList;
  }, [
    currentVersionData,
    changeDescription,
    getDiffByFieldName,
    handleFeatureDescriptionChangeDiff,
    handleFeatureTagChangeDiff,
  ]);

  const handleTabChange = (activeKey: string) => {
    history.push(
      getVersionPathWithTab(
        EntityType.MLMODEL,
        currentVersionData.fullyQualifiedName ?? '',
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

  const tags = useMemo(() => {
    return getEntityVersionTags(currentVersionData, changeDescription);
  }, [currentVersionData, changeDescription]);

  const description = useMemo(() => {
    return getEntityVersionDescription(currentVersionData, changeDescription);
  }, [currentVersionData, changeDescription]);

  return (
    <PageLayoutV1
      pageTitle={t('label.entity-detail-plural', {
        entity: getEntityName(currentVersionData),
      })}>
      {isVersionLoading ? (
        <Loader />
      ) : (
        <div className={classNames('version-data')} data-testid="version-data">
          <EntityPageInfo
            isVersionSelected
            deleted={deleted}
            displayName={currentVersionData.displayName}
            entityName={
              currentVersionData.displayName ?? currentVersionData.name ?? ''
            }
            extraInfo={extraInfo}
            followersList={[]}
            serviceType={currentVersionData.serviceType ?? ''}
            tags={tags}
            tier={{} as TagLabel}
            titleLinks={slashedMlModelName}
            version={Number(version)}
            versionHandler={backHandler}
          />
          <div className="m-t-xss">
            <Tabs
              defaultActiveKey={tab ?? EntityTabs.FEATURES}
              onChange={handleTabChange}>
              <Tabs.TabPane
                key={EntityTabs.FEATURES}
                tab={
                  <TabsLabel
                    id={EntityTabs.FEATURES}
                    name={t('label.feature-plural')}
                  />
                }>
                <Card className="m-y-md">
                  <Description isReadOnly description={description} />
                  <div>
                    {(currentVersionData as Mlmodel).mlFeatures &&
                    (currentVersionData as Mlmodel).mlFeatures?.length ? (
                      <Fragment>
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
                                data-testid="feature-card"
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
                                      <Col flex="120px">
                                        <Typography.Text className="text-grey-muted">
                                          {`${t(
                                            'label.glossary-term-plural'
                                          )} :`}
                                        </Typography.Text>
                                      </Col>

                                      <Col flex="auto">
                                        <TagsViewer
                                          sizeCap={-1}
                                          tags={
                                            getFilterTags(feature.tags ?? [])
                                              .Glossary
                                          }
                                          type="border"
                                        />
                                      </Col>
                                    </Row>
                                  </Col>

                                  <Col className="m-b-xs" span={24}>
                                    <Row gutter={8} wrap={false}>
                                      <Col flex="120px">
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
                                          type="border"
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
                      </Fragment>
                    ) : (
                      <ErrorPlaceHolder />
                    )}
                  </div>
                </Card>
              </Tabs.TabPane>
              <Tabs.TabPane
                key={EntityTabs.CUSTOM_PROPERTIES}
                tab={
                  <TabsLabel
                    id={EntityTabs.CUSTOM_PROPERTIES}
                    name={t('label.custom-property-plural')}
                  />
                }>
                <CustomPropertyTable
                  isVersionView
                  entityDetails={
                    currentVersionData as CustomPropertyProps['entityDetails']
                  }
                  entityType={EntityType.MLMODEL}
                  hasEditAccess={false}
                />
              </Tabs.TabPane>
            </Tabs>
          </div>
        </div>
      )}

      <EntityVersionTimeLine
        show
        currentVersion={version}
        versionHandler={versionHandler}
        versionList={versionList}
        onBack={backHandler}
      />
    </PageLayoutV1>
  );
};

export default MlModelVersion;
