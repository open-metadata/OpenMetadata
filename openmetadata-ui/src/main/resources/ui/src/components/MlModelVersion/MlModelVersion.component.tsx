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
import { CustomPropertyTable } from 'components/common/CustomPropertyTable/CustomPropertyTable';
import { CustomPropertyProps } from 'components/common/CustomPropertyTable/CustomPropertyTable.interface';
import DescriptionV1 from 'components/common/description/DescriptionV1';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import DataAssetsVersionHeader from 'components/DataAssets/DataAssetsVersionHeader/DataAssetsVersionHeader';
import SourceList from 'components/MlModelDetail/SourceList.component';
import TabsLabel from 'components/TabsLabel/TabsLabel.component';
import TagsContainerV2 from 'components/Tag/TagsContainerV2/TagsContainerV2';
import TagsViewer from 'components/Tag/TagsViewer/TagsViewer';
import { getVersionPathWithTab } from 'constants/constants';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { EntityTabs, EntityType } from 'enums/entity.enum';
import { MlFeature, Mlmodel } from 'generated/entity/data/mlmodel';
import { TagSource } from 'generated/type/tagLabel';
import { cloneDeep, isEqual } from 'lodash';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { getFilterTags } from 'utils/TableTags/TableTags.utils';
import { EntityField } from '../../constants/Feeds.constants';
import { ChangeDescription } from '../../generated/entity/data/dashboard';
import {
  getChangedEntityName,
  getChangedEntityNewValue,
  getChangedEntityOldValue,
  getCommonExtraInfoForVersionDetails,
  getDiffByFieldName,
  getEntityVersionByField,
  getEntityVersionTags,
  getTagsDiff,
  getTextDiff,
  removeDuplicateTags,
} from '../../utils/EntityVersionUtils';
import { TagLabelWithStatus } from '../../utils/EntityVersionUtils.interface';
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
  entityPermissions,
}: MlModelVersionProp) => {
  const { t } = useTranslation();
  const history = useHistory();
  const { tab } = useParams<{ tab: EntityTabs }>();

  const [changeDescription, setChangeDescription] = useState<ChangeDescription>(
    currentVersionData.changeDescription as ChangeDescription
  );

  const { ownerDisplayName, ownerRef, tierDisplayName } = useMemo(
    () => getCommonExtraInfoForVersionDetails(changeDescription, owner, tier),
    [changeDescription, owner, tier]
  );

  const handleFeatureDescriptionChangeDiff = (
    colList: Mlmodel['mlFeatures'],
    oldDiff: MlFeature[],
    newDiff: MlFeature[]
  ) => {
    colList?.forEach((i) => {
      if (isEqual(i.name, newDiff[0]?.name)) {
        i.description = getTextDiff(
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
                  {(currentVersionData as Mlmodel).mlFeatures &&
                  (currentVersionData as Mlmodel).mlFeatures?.length ? (
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
                {Object.keys(TagSource).map((tagType) => (
                  <TagsContainerV2
                    entityFqn={currentVersionData.fullyQualifiedName}
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
        children: !entityPermissions.ViewAll ? (
          <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />
        ) : (
          <CustomPropertyTable
            isVersionView
            entityDetails={
              currentVersionData as CustomPropertyProps['entityDetails']
            }
            entityType={EntityType.MLMODEL}
            hasEditAccess={false}
          />
        ),
      },
    ],
    [description, mlFeaturesData, currentVersionData, entityPermissions]
  );

  if (!(entityPermissions.ViewAll || entityPermissions.ViewBasic)) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

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
                ownerDisplayName={ownerDisplayName}
                ownerRef={ownerRef}
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
        show
        currentVersion={version}
        versionHandler={versionHandler}
        versionList={versionList}
        onBack={backHandler}
      />
    </>
  );
};

export default MlModelVersion;
