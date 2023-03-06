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
import Tags from 'components/Tag/Tags/tags';
import { isEmpty } from 'lodash';
import { EntityTags, TagOption } from 'Models';
import React, { FC, Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SettledStatus } from '../../enums/axios.enum';
import { MlFeature, Mlmodel } from '../../generated/entity/data/mlmodel';
import { LabelType, State } from '../../generated/type/tagLabel';
import {
  fetchGlossaryTerms,
  getGlossaryTermlist,
} from '../../utils/GlossaryUtils';
import SVGIcons from '../../utils/SvgUtils';
import { getClassifications, getTaglist } from '../../utils/TagsUtils';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
import { ModalWithMarkdownEditor } from '../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import { OperationPermission } from '../PermissionProvider/PermissionProvider.interface';
import TagsContainer from '../Tag/TagsContainer/tags-container';
import SourceList from './SourceList.component';

interface MlModelFeaturesListProp {
  mlFeatures: Mlmodel['mlFeatures'];
  permissions: OperationPermission;
  handleFeaturesUpdate: (features: Mlmodel['mlFeatures']) => Promise<void>;
}

const MlModelFeaturesList: FC<MlModelFeaturesListProp> = ({
  mlFeatures,
  handleFeaturesUpdate,
  permissions,
}: MlModelFeaturesListProp) => {
  const { t } = useTranslation();
  const [selectedFeature, setSelectedFeature] = useState<MlFeature>(
    {} as MlFeature
  );
  const [editTag, setEditTag] = useState<boolean>(false);
  const [editDescription, setEditDescription] = useState<boolean>(false);
  const [allTags, setAllTags] = useState<Array<TagOption>>([]);
  const [isTagLoading, setIsTagLoading] = useState<boolean>(false);
  const [tagFetchFailed, setTagFetchFailed] = useState<boolean>(false);

  const handleCancelEditDescription = () => {
    setSelectedFeature({});
    setEditDescription(false);
  };

  const handleCancelEditTags = () => {
    setEditTag(false);
    setSelectedFeature({});
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

  const handleTagsChange = (
    selectedTags?: Array<EntityTags>,
    feature?: MlFeature
  ) => {
    const newSelectedTags = selectedTags?.map((tag) => {
      return {
        tagFQN: tag.tagFQN,
        source: tag.source,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      };
    });

    const isFeatureSelected = !isEmpty(selectedFeature) || !isEmpty(feature);
    const targetFeature = !isEmpty(feature) ? feature : selectedFeature;
    if (newSelectedTags && isFeatureSelected) {
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
      handleFeaturesUpdate(updatedFeatures);
    }
    handleCancelEditTags();
  };

  const fetchTagsAndGlossaryTerms = () => {
    setIsTagLoading(true);
    Promise.allSettled([getClassifications(), fetchGlossaryTerms()])
      .then(async (values) => {
        let tagsAndTerms: TagOption[] = [];
        if (
          values[0].status === SettledStatus.FULFILLED &&
          values[0].value.data
        ) {
          const tagList = await getTaglist(values[0].value.data);
          tagsAndTerms = tagList.map((tag) => {
            return { fqn: tag, source: 'Tag' };
          });
        }
        if (
          values[1].status === SettledStatus.FULFILLED &&
          values[1].value &&
          values[1].value.length > 0
        ) {
          const glossaryTerms: TagOption[] = getGlossaryTermlist(
            values[1].value
          ).map((tag) => {
            return { fqn: tag, source: 'Glossary' };
          });
          tagsAndTerms = [...tagsAndTerms, ...glossaryTerms];
        }
        setAllTags(tagsAndTerms);
        if (
          values[0].status === SettledStatus.FULFILLED &&
          values[1].status === SettledStatus.FULFILLED
        ) {
          setTagFetchFailed(false);
        } else {
          setTagFetchFailed(true);
        }
      })
      .catch(() => {
        setAllTags([]);
        setTagFetchFailed(true);
      })
      .finally(() => {
        setIsTagLoading(false);
      });
  };

  const handleTagContainerClick = (feature: MlFeature) => {
    setSelectedFeature(feature);
    setEditTag(true);
    // Fetch tags and terms only once
    if (allTags.length === 0 || tagFetchFailed) {
      fetchTagsAndGlossaryTerms();
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
              {t('label.features-used')}
            </Typography.Title>
          </Col>

          {mlFeatures.map((feature: MlFeature) => (
            <Col key={feature.fullyQualifiedName} span={24}>
              <Card
                className="m-b-lg shadow-none"
                data-testid="feature-card"
                key={feature.fullyQualifiedName}>
                <Row>
                  <Col className="m-b-xs" span={24}>
                    <Typography.Text className="font-semibold">
                      {feature.name}
                    </Typography.Text>
                  </Col>
                  <Col span={24}>
                    <Space align="start">
                      <Space>
                        <Typography.Text className="text-grey-muted">
                          {`${t('label.type')}:`}
                        </Typography.Text>{' '}
                        <Typography.Text>
                          {feature.dataType || '--'}
                        </Typography.Text>
                      </Space>
                      <Divider className="border-gray" type="vertical" />
                      <Space>
                        <Typography.Text className="text-grey-muted">
                          {`${t('label.algorithm')}:`}
                        </Typography.Text>{' '}
                        <Typography.Text>
                          {feature.featureAlgorithm || '--'}
                        </Typography.Text>
                      </Space>
                      <Divider className="border-gray" type="vertical" />
                      <Space align="start">
                        <Typography.Text className="text-grey-muted">
                          {`${t('label.tag-plural')}:`}
                        </Typography.Text>{' '}
                        <div
                          data-testid="feature-tags-wrapper"
                          onClick={() => handleTagContainerClick(feature)}>
                          <TagsContainer
                            editable={
                              selectedFeature?.name === feature.name && editTag
                            }
                            isLoading={
                              isTagLoading &&
                              selectedFeature?.name === feature.name &&
                              editTag
                            }
                            selectedTags={feature.tags || []}
                            size="small"
                            tagList={allTags}
                            type="label"
                            onCancel={handleCancelEditTags}
                            onSelectionChange={(selectedTags) =>
                              handleTagsChange(selectedTags, feature)
                            }>
                            {feature.tags?.length ? (
                              <Tooltip
                                title={
                                  permissions.EditAll || permissions.EditTags
                                    ? t('label.edit-entity', {
                                        entity: t('label.tag-plural'),
                                      })
                                    : t('message.no-permission-for-action')
                                }>
                                <Button
                                  className="p-0 h-auto"
                                  disabled={
                                    !(
                                      permissions.EditAll ||
                                      permissions.EditTags
                                    )
                                  }
                                  type="text">
                                  <SVGIcons
                                    alt="edit"
                                    icon="icon-edit"
                                    title="Edit"
                                    width="16px"
                                  />
                                </Button>
                              </Tooltip>
                            ) : (
                              <Tooltip
                                title={
                                  permissions.EditAll || permissions.EditTags
                                    ? t('label.edit-entity', {
                                        entity: t('label.tag-plural'),
                                      })
                                    : t('message.no-permission-for-action')
                                }>
                                <Button
                                  className="p-0 h-auto"
                                  disabled={
                                    !(
                                      permissions.EditAll ||
                                      permissions.EditTags
                                    )
                                  }
                                  type="text">
                                  <Tags
                                    startWith="+ "
                                    tag={t('label.add-entity', {
                                      entity: t('label.tag-lowercase'),
                                    })}
                                    type="outlined"
                                  />
                                </Button>
                              </Tooltip>
                            )}
                          </TagsContainer>
                        </div>
                      </Space>
                    </Space>
                  </Col>
                  <Col className="m-t-sm" span={24}>
                    <Space direction="vertical">
                      <Typography.Text className="text-grey-muted">
                        {`${t('label.description')}:`}
                      </Typography.Text>
                      <Space>
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
                            permissions.EditAll || permissions.EditDescription
                              ? t('label.edit')
                              : t('message.no-permission-for-action')
                          }>
                          <Button
                            className="no-border p-0"
                            disabled={
                              !(
                                permissions.EditAll ||
                                permissions.EditDescription
                              )
                            }
                            onClick={() => {
                              setSelectedFeature(feature);
                              setEditDescription(true);
                            }}>
                            <SVGIcons
                              alt="edit"
                              icon="icon-edit"
                              width="16px"
                            />
                          </Button>
                        </Tooltip>
                      </Space>
                    </Space>
                  </Col>
                  <Col span={24}>
                    <SourceList feature={feature} />
                  </Col>
                </Row>
              </Card>
            </Col>
          ))}
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
    return (
      <ErrorPlaceHolder>
        {t('message.no-features-data-available')}
      </ErrorPlaceHolder>
    );
  }
};

export default MlModelFeaturesList;
