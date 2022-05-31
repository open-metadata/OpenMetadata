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
}) => {
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

  if (mlFeatures && mlFeatures.length) {
    return (
      <Fragment>
        <div className="tw-flex tw-flex-col" data-testid="feature-list">
          <hr className="tw-my-4" />
          <h6 className="tw-font-medium tw-text-base">Features used</h6>
          {mlFeatures.map((feature) => (
            <div
              className="tw-bg-white tw-shadow-md tw-border tw-border-main tw-rounded-md tw-p-4 tw-mb-8"
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
                    className="tw-ml-2 tw-mt-1 tw-self-center"
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
                      permission={Operation.UpdateTags}
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
                        onCancel={() => {
                          handleTagsChange();
                        }}
                        onSelectionChange={(tags) => {
                          handleTagsChange(tags);
                        }}>
                        {feature.tags?.length ? (
                          <button className="tw-ml-1 tw--mt-1 focus:tw-outline-none">
                            <SVGIcons
                              alt="edit"
                              icon="icon-edit"
                              title="Edit"
                              width="12px"
                            />
                          </button>
                        ) : (
                          <span className="tw-text-grey-muted hover:tw-text-primary">
                            <Tags
                              className="tw--ml-2"
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

              <div className="tw-flex tw-flex-col tw-mt-2">
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
                    permission={Operation.UpdateDescription}
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
                        width="12px"
                      />
                    </button>
                  </NonAdminAction>
                </div>
              </div>

              <div className="tw-mt-2">
                <span className="tw-text-grey-muted">Sources:</span>{' '}
                <table
                  className="tw-w-full tw-mt-3"
                  data-testid="sources-table"
                  id="sources-table">
                  <thead>
                    <tr className="tableHead-row">
                      <th className="tableHead-cell">Name</th>
                      <th className="tableHead-cell">Data Type</th>
                      <th className="tableHead-cell">Data Source</th>
                    </tr>
                  </thead>
                  <tbody className="tableBody">
                    {feature.featureSources && feature.featureSources.length ? (
                      feature.featureSources?.map((source) => (
                        <tr
                          className={classNames('tableBody-row')}
                          data-testid="tableBody-row"
                          key={uniqueId()}>
                          <td
                            className="tableBody-cell"
                            data-testid="tableBody-cell">
                            {source.name}
                          </td>
                          <td
                            className="tableBody-cell"
                            data-testid="tableBody-cell">
                            {source.dataType || '--'}
                          </td>
                          <td
                            className="tableBody-cell"
                            data-testid="tableBody-cell">
                            <span>
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
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr
                        className={classNames('tableBody-row')}
                        data-testid="tableBody-row"
                        key={uniqueId()}>
                        <td
                          className="tableBody-cell tw-text-center tw-text-grey-muted"
                          colSpan={2}
                          data-testid="tableBody-cell">
                          No data
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
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

export default MlModelFeaturesList;
