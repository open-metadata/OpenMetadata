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
  Button,
  Card,
  Col,
  Divider,
  Row,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import { ReactComponent as EditIcon } from 'assets/svg/edit-new.svg';
import TableTags from 'components/TableTags/TableTags.component';
import { TagLabel, TagSource } from 'generated/type/schema';
import { isEmpty, map } from 'lodash';
import { EntityTags, TagOption } from 'Models';
import React, { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getFilterTags } from 'utils/TableTags/TableTags.utils';
import { MlFeature } from '../../generated/entity/data/mlmodel';
import { LabelType, State } from '../../generated/type/tagLabel';
import {
  fetchGlossaryTerms,
  getGlossaryTermlist,
} from '../../utils/GlossaryUtils';
import { getClassifications, getTaglist } from '../../utils/TagsUtils';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
import { ModalWithMarkdownEditor } from '../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import { MlModelFeaturesListProp } from './MlModel.interface';
import SourceList from './SourceList.component';

const MlModelFeaturesList = ({
  mlFeatures,
  handleFeaturesUpdate,
  permissions,
  isDeleted,
}: MlModelFeaturesListProp) => {
  const { t } = useTranslation();
  const [selectedFeature, setSelectedFeature] = useState<MlFeature>(
    {} as MlFeature
  );
  const [editDescription, setEditDescription] = useState<boolean>(false);
  const [isTagLoading, setIsTagLoading] = useState<boolean>(false);
  const [isGlossaryLoading, setIsGlossaryLoading] = useState<boolean>(false);
  const [tagFetchFailed, setTagFetchFailed] = useState<boolean>(false);

  const [glossaryTags, setGlossaryTags] = useState<TagOption[]>([]);
  const [classificationTags, setClassificationTags] = useState<TagOption[]>([]);

  const hasEditPermission = useMemo(
    () => permissions.EditTags || permissions.EditAll,
    [permissions]
  );

  const handleCancelEditDescription = () => {
    setSelectedFeature({});
    setEditDescription(false);
  };

  const handleDescriptionChange = async (value: string) => {
    if (!isEmpty(selectedFeature) && editDescription) {
      const updatedFeatures = mlFeatures?.map((feature) => {
        if (feature.name === selectedFeature.name) {
          return {
            ...selectedFeature,
            description: value,
          };
        } else {
          return feature;
        }
      });
      await handleFeaturesUpdate(updatedFeatures);
      handleCancelEditDescription();
    }
  };

  const handleTagsChange = async (
    selectedTags: EntityTags[],
    targetFeature: MlFeature,
    otherTags: TagLabel[]
  ) => {
    const newSelectedTags = [...selectedTags, ...otherTags].map((tag) => {
      return {
        tagFQN: tag.tagFQN,
        source: tag.source,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      };
    });

    if (newSelectedTags && targetFeature) {
      const updatedFeatures = mlFeatures?.map((feature) => {
        if (feature.name === targetFeature?.name) {
          return {
            ...targetFeature,
            tags: newSelectedTags,
          };
        } else {
          return feature;
        }
      });
      await handleFeaturesUpdate(updatedFeatures);
    }
  };

  const fetchGlossaryTags = async () => {
    setIsGlossaryLoading(true);
    try {
      const res = await fetchGlossaryTerms();

      const glossaryTerms: TagOption[] = getGlossaryTermlist(res).map(
        (tag) => ({ fqn: tag, source: TagSource.Glossary })
      );
      setGlossaryTags(glossaryTerms);
    } catch {
      setTagFetchFailed(true);
    } finally {
      setIsGlossaryLoading(false);
    }
  };

  const fetchClassificationTags = async () => {
    setIsTagLoading(true);
    try {
      const res = await getClassifications();
      const tagList = await getTaglist(res.data);

      const classificationTag: TagOption[] = map(tagList, (tag) => ({
        fqn: tag,
        source: TagSource.Classification,
      }));

      setClassificationTags(classificationTag);
    } catch {
      setTagFetchFailed(true);
    } finally {
      setIsTagLoading(false);
    }
  };

  if (mlFeatures && mlFeatures.length) {
    return (
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

          {mlFeatures?.map((feature: MlFeature, index) => {
            return (
              <Col key={feature.fullyQualifiedName} span={24}>
                <Card
                  className="m-b-lg shadow-none"
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
                            {`${t('label.type')} :`}
                          </Typography.Text>{' '}
                          <Typography.Text>
                            {feature.dataType || '--'}
                          </Typography.Text>
                        </Space>
                        <Divider className="border-gray" type="vertical" />
                        <Space>
                          <Typography.Text className="text-grey-muted">
                            {`${t('label.algorithm')} :`}
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
                          <TableTags<MlFeature>
                            showInlineEditTagButton
                            dataTestId="glossary-tags"
                            fetchTags={fetchGlossaryTags}
                            handleTagSelection={handleTagsChange}
                            hasTagEditAccess={hasEditPermission}
                            index={index}
                            isReadOnly={isDeleted}
                            isTagLoading={isGlossaryLoading}
                            record={feature}
                            tagFetchFailed={tagFetchFailed}
                            tagList={glossaryTags}
                            tags={getFilterTags(feature.tags ?? [])}
                            type={TagSource.Glossary}
                          />
                        </Col>
                      </Row>
                    </Col>

                    <Col span={24}>
                      <Row gutter={8} wrap={false}>
                        <Col flex="130px">
                          <Typography.Text className="text-grey-muted">
                            {`${t('label.tag-plural')} :`}
                          </Typography.Text>
                        </Col>
                        <Col flex="auto">
                          <TableTags<MlFeature>
                            showInlineEditTagButton
                            dataTestId="classification-tags"
                            fetchTags={fetchClassificationTags}
                            handleTagSelection={handleTagsChange}
                            hasTagEditAccess={hasEditPermission}
                            index={index}
                            isReadOnly={isDeleted}
                            isTagLoading={isTagLoading}
                            record={feature}
                            tagFetchFailed={tagFetchFailed}
                            tagList={classificationTags}
                            tags={getFilterTags(feature.tags ?? [])}
                            type={TagSource.Classification}
                          />
                        </Col>
                      </Row>
                    </Col>

                    <Col className="m-t-xs" span={24}>
                      <Row gutter={8} wrap={false}>
                        <Col flex="130px">
                          <Typography.Text className="text-grey-muted">
                            {`${t('label.description')} :`}
                          </Typography.Text>
                        </Col>
                        <Col flex="auto">
                          <Space align="start">
                            {feature.description ? (
                              <RichTextEditorPreviewer
                                markdown={feature.description}
                              />
                            ) : (
                              <Typography.Text className="text-grey-muted">
                                {t('label.no-entity', {
                                  entity: t('label.description'),
                                })}
                              </Typography.Text>
                            )}
                            <Tooltip
                              title={
                                permissions.EditAll ||
                                permissions.EditDescription
                                  ? t('label.edit')
                                  : t('message.no-permission-for-action')
                              }>
                              <Button
                                className="m-l-xxs no-border p-0 text-primary h-auto"
                                disabled={
                                  !(
                                    permissions.EditAll ||
                                    permissions.EditDescription
                                  )
                                }
                                icon={<EditIcon width={16} />}
                                type="text"
                                onClick={() => {
                                  setSelectedFeature(feature);
                                  setEditDescription(true);
                                }}
                              />
                            </Tooltip>
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
            );
          })}
        </Row>
        {!isEmpty(selectedFeature) && (
          <ModalWithMarkdownEditor
            header={t('label.edit-entity-name', {
              entityType: t('label.feature'),
              entityName: selectedFeature.name,
            })}
            placeholder={t('label.enter-field-description', {
              field: t('label.feature-lowercase'),
            })}
            value={selectedFeature.description as string}
            visible={editDescription}
            onCancel={handleCancelEditDescription}
            onSave={handleDescriptionChange}
          />
        )}
      </Fragment>
    );
  } else {
    return <ErrorPlaceHolder />;
  }
};

export default MlModelFeaturesList;
