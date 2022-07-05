/*
 *  Copyright 2021 Collate
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

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import classNames from 'classnames';
import { isEmpty, uniqueId } from 'lodash';
import { EntityTags, TagOption } from 'Models';
import React, { FC, Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { SettledStatus } from '../../enums/axios.enum';
import { EntityType } from '../../enums/entity.enum';
import { MlFeature, Mlmodel } from '../../generated/entity/data/mlmodel';
import { Operation } from '../../generated/entity/policies/accessControl/rule';
import { LabelType, State } from '../../generated/type/tagLabel';
import {
  getEntityName,
  getHtmlForNonAdminAction,
} from '../../utils/CommonUtils';
import {
  fetchGlossaryTerms,
  getGlossaryTermlist,
} from '../../utils/GlossaryUtils';
import SVGIcons from '../../utils/SvgUtils';
import { getEntityLink } from '../../utils/TableUtils';
import { getTagCategories, getTaglist } from '../../utils/TagsUtils';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
import { ModalWithMarkdownEditor } from '../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor';
import TagsContainer from '../tags-container/tags-container';
import Tags from '../tags/tags';

interface MlModelFeaturesListProp {
  mlFeatures: Mlmodel['mlFeatures'];
  owner: Mlmodel['owner'];
  hasEditAccess: boolean;
  handleFeaturesUpdate: (features: Mlmodel['mlFeatures']) => void;
}

const MlModelFeaturesList: FC<MlModelFeaturesListProp> = ({
  mlFeatures,
  owner,
  hasEditAccess,
  handleFeaturesUpdate,
}: MlModelFeaturesListProp) => {
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

  const handleDescriptionChange = (value: string) => {
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
      handleFeaturesUpdate(updatedFeatures);
    }
    handleCancelEditDescription();
  };

  const handleTagsChange = (selectedTags?: Array<EntityTags>) => {
    const newSelectedTags = selectedTags?.map((tag) => {
      return {
        tagFQN: tag.tagFQN,
        source: tag.source,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      };
    });
    if (newSelectedTags && editTag && !isEmpty(selectedFeature)) {
      const updatedFeatures = mlFeatures?.map((feature) => {
        if (feature.name === selectedFeature.name) {
          return {
            ...selectedFeature,
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
    Promise.allSettled([getTagCategories(), fetchGlossaryTerms()])
      .then((values) => {
        let tagsAndTerms: TagOption[] = [];
        if (
          values[0].status === SettledStatus.FULFILLED &&
          values[0].value.data
        ) {
          tagsAndTerms = getTaglist(values[0].value.data).map((tag) => {
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

  const Separator = () => {
    return <span className="tw-mx-2 tw-inline-block tw-text-gray-400">|</span>;
  };

  const SourceList = ({ feature }: { feature: MlFeature }) => {
    const [isActive, setIsActive] = useState(false);
    const dataCheck =
      feature.featureSources && feature.featureSources.length && isActive;

    return (
      <div className="tw-mt-4">
        <div className="tw-font-semibold tw-mb-2">
          {' '}
          <span onClick={() => setIsActive((prev) => !prev)}>
            <FontAwesomeIcon
              className="tw-text-xs tw-text-primary tw-cursor-pointer"
              icon={isActive ? 'chevron-down' : 'chevron-right'}
            />
          </span>
          <span className={classNames('tw-ml-2', { 'tw-mb-2': !isActive })}>
            Sources
          </span>
        </div>{' '}
        {dataCheck &&
          feature.featureSources?.map((source, i) => (
            <div
              className="tw-flex tw-justify-between tw-border-t tw-border-main tw-px-4 tw-py-2 tw--mx-4"
              key={uniqueId()}>
              <span className="tw-w-36">{String(i + 1).padStart(2, '0')}</span>

              <span className="tw-w-36">
                <span className="tw-text-grey-muted">Name:</span>
                <span className="tw-ml-2">{source.name}</span>
              </span>

              <span className="tw-w-36">
                <span className="tw-text-grey-muted">Type:</span>
                <span className="tw-ml-2">{source.dataType}</span>
              </span>

              <span>
                <span className="tw-text-grey-muted">Data Source:</span>
                <span className="tw-ml-2">
                  <Link
                    to={getEntityLink(
                      EntityType.TABLE,
                      source.dataSource?.fullyQualifiedName ||
                        source.dataSource?.name ||
                        ''
                    )}>
                    {getEntityName(source.dataSource)}
                  </Link>
                </span>
              </span>
            </div>
          ))}
      </div>
    );
  };

  const render = () => {
    if (mlFeatures && mlFeatures.length) {
      return (
        <Fragment>
          <div className="tw-flex tw-flex-col" data-testid="feature-list">
            <hr className="tw-my-4" />
            <h6 className="tw-font-medium tw-text-base">Features used</h6>
            {mlFeatures.map((feature: MlFeature) => (
              <div
                className="tw-bg-white tw-shadow-md tw-border tw-border-main tw-rounded-md tw-p-4 tw-pb-0 tw-mb-8"
                data-testid="feature-card"
                key={uniqueId()}>
                <h6 className="tw-font-semibold">{feature.name}</h6>

                <div className="tw-flex">
                  <div className="tw-flex">
                    <span className="tw-text-grey-muted">Type:</span>{' '}
                    <span className="tw-ml-2">{feature.dataType || '--'}</span>
                  </div>
                  <Separator />
                  <div className="tw-flex">
                    <span className="tw-text-grey-muted">Algorithm:</span>{' '}
                    <span className="tw-ml-2">
                      {feature.featureAlgorithm || '--'}
                    </span>
                  </div>
                  <Separator />
                  <div className="tw-flex">
                    <span className="tw-text-grey-muted">Tags:</span>{' '}
                    <div
                      className="tw-ml-1 tw-self-center"
                      data-testid="feature-tags-wrapper"
                      onClick={() => {
                        setSelectedFeature(feature);
                        setEditTag(true);
                        // Fetch tags and terms only once
                        if (allTags.length === 0 || tagFetchFailed) {
                          fetchTagsAndGlossaryTerms();
                        }
                      }}>
                      <NonAdminAction
                        html={getHtmlForNonAdminAction(Boolean(owner))}
                        isOwner={hasEditAccess}
                        permission={Operation.EditTags}
                        position="left"
                        trigger="click">
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
                          onSelectionChange={handleTagsChange}>
                          {feature.tags?.length ? (
                            <button className="tw-ml-1 focus:tw-outline-none">
                              <SVGIcons
                                alt="edit"
                                icon="icon-edit"
                                title="Edit"
                                width="16px"
                              />
                            </button>
                          ) : (
                            <span className="tw-text-grey-muted hover:tw-text-primary">
                              <Tags
                                startWith="+ "
                                tag="Add tag"
                                type="outlined"
                              />
                            </span>
                          )}
                        </TagsContainer>
                      </NonAdminAction>
                    </div>
                  </div>
                </div>

                <div className="tw-flex tw-flex-col tw-mt-4">
                  <span className="tw-text-grey-muted">Description:</span>{' '}
                  <div className="tw-flex tw-mt-2">
                    {feature.description ? (
                      <RichTextEditorPreviewer markdown={feature.description} />
                    ) : (
                      <span className="tw-no-description">No description </span>
                    )}
                    <NonAdminAction
                      html={getHtmlForNonAdminAction(Boolean(owner))}
                      isOwner={hasEditAccess}
                      permission={Operation.EditDescription}
                      position="top">
                      <button
                        className="tw-self-start tw-w-8 tw-h-auto focus:tw-outline-none"
                        onClick={() => {
                          setSelectedFeature(feature);
                          setEditDescription(true);
                        }}>
                        <SVGIcons
                          alt="edit"
                          icon="icon-edit"
                          title="Edit"
                          width="16px"
                        />
                      </button>
                    </NonAdminAction>
                  </div>
                </div>
                <SourceList feature={feature} />
              </div>
            ))}
          </div>
          {!isEmpty(selectedFeature) && editDescription && (
            <ModalWithMarkdownEditor
              header={`Edit feature: "${selectedFeature.name}"`}
              placeholder="Enter feature description"
              value={selectedFeature.description as string}
              onCancel={handleCancelEditDescription}
              onSave={handleDescriptionChange}
            />
          )}
        </Fragment>
      );
    } else {
      return (
        <div className="tw-flex tw-justify-center tw-font-medium tw-items-center tw-border tw-border-main tw-rounded-md tw-p-8">
          No features data available
        </div>
      );
    }
  };

  return render();
};

export default MlModelFeaturesList;
