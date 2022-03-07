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
import { cloneDeep, includes, isEqual } from 'lodash';
import { EntityTags, FormatedUsersData, GlossaryTermAssets } from 'Models';
import React, { useEffect, useState } from 'react';
import {
  LIST_SIZE,
  TITLE_FOR_NON_ADMIN_ACTION,
} from '../../constants/constants';
import {
  GlossaryTerm,
  TermReference,
} from '../../generated/entity/data/glossaryTerm';
import { LabelType, State } from '../../generated/type/tagLabel';
import UserCard from '../../pages/teams/UserCard';
import SVGIcons from '../../utils/SvgUtils';
import { getTagCategories, getTaglist } from '../../utils/TagsUtils';
import { Button } from '../buttons/Button/Button';
import Description from '../common/description/Description';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import PopOver from '../common/popover/PopOver';
import TabsPane from '../common/TabsPane/TabsPane';
import GlossaryReferenceModal from '../Modals/GlossaryReferenceModal/GlossaryReferenceModal';
import ReviewerModal from '../Modals/ReviewerModal/ReviewerModal.component';
import TagsContainer from '../tags-container/tags-container';
import Tags from '../tags/tags';
import AssetsTabs from './tabs/AssetsTabs.component';
import RelationshipTab from './tabs/RelationshipTab.component';
type Props = {
  assetData: GlossaryTermAssets;
  isHasAccess: boolean;
  glossaryTerm: GlossaryTerm;
  handleGlossaryTermUpdate: (data: GlossaryTerm) => void;
  onAssetPaginate: (num: number) => void;
};

const GlossaryTermsV1 = ({
  assetData,
  isHasAccess,
  glossaryTerm,
  handleGlossaryTermUpdate,
  onAssetPaginate,
}: Props) => {
  const [isTagEditable, setIsTagEditable] = useState<boolean>(false);
  const [tagList, setTagList] = useState<Array<string>>([]);
  const [isTagLoading, setIsTagLoading] = useState<boolean>(false);
  const [isDescriptionEditable, setIsDescriptionEditable] = useState(false);
  const [activeTab, setActiveTab] = useState(1);
  const [showRevieweModal, setShowRevieweModal] = useState(false);
  const [isSynonymsEditing, setIsSynonymsEditing] = useState(false);
  const [isReferencesEditing, setIsReferencesEditing] = useState(false);
  const [synonyms, setSynonyms] = useState(
    glossaryTerm.synonyms?.join(',') || ''
  );
  const [references, setReferences] = useState(glossaryTerm.references || []);
  const [reviewer, setReviewer] = useState<Array<FormatedUsersData>>([]);
  const [relatedTerms, setRelatedTerms] = useState<
    {
      relatedTerms: string;
      description: string;
    }[]
  >([]);

  const tabs = [
    {
      name: 'Related Terms',
      isProtected: false,
      position: 1,
    },
    {
      name: 'Assets',
      isProtected: false,
      position: 2,
    },
    {
      name: 'Reviewers',
      isProtected: false,
      position: 3,
    },
  ];

  const onReviewerModalCancel = () => {
    setShowRevieweModal(false);
  };

  const handleReviewerSave = (data: Array<FormatedUsersData>) => {
    if (!isEqual(data, reviewer)) {
      let updatedGlossaryTerm = cloneDeep(glossaryTerm);
      const oldReviewer = data.filter((d) => includes(reviewer, d));
      const newReviewer = data
        .filter((d) => !includes(reviewer, d))
        .map((d) => ({ id: d.id, type: d.type }));
      updatedGlossaryTerm = {
        ...updatedGlossaryTerm,
        reviewers: [...oldReviewer, ...newReviewer],
      };
      setReviewer(data);
      handleGlossaryTermUpdate(updatedGlossaryTerm);
    }
    onReviewerModalCancel();
  };

  const activeTabHandler = (tab: number) => {
    setActiveTab(tab);
  };

  const onDescriptionEdit = (): void => {
    setIsDescriptionEditable(true);
  };
  const onCancel = () => {
    setIsDescriptionEditable(false);
  };

  const onTagUpdate = (selectedTags?: Array<string>) => {
    if (selectedTags) {
      const prevTags =
        glossaryTerm?.tags?.filter((tag) =>
          selectedTags.includes(tag?.tagFQN as string)
        ) || [];
      const newTags = selectedTags
        .filter((tag) => {
          return !prevTags?.map((prevTag) => prevTag.tagFQN).includes(tag);
        })
        .map((tag) => ({
          labelType: LabelType.Manual,
          state: State.Confirmed,
          tagFQN: tag,
        }));
      const updatedTags = [...prevTags, ...newTags];
      const updatedGlossary = { ...glossaryTerm, tags: updatedTags };
      handleGlossaryTermUpdate(updatedGlossary);
    }
  };

  const onDescriptionUpdate = (updatedHTML: string) => {
    if (glossaryTerm.description !== updatedHTML) {
      const updatedGlossaryTermDetails = {
        ...glossaryTerm,
        description: updatedHTML,
      };
      handleGlossaryTermUpdate(updatedGlossaryTermDetails);
      setIsDescriptionEditable(false);
    } else {
      setIsDescriptionEditable(false);
    }
  };

  const getSelectedTags = () => {
    return (glossaryTerm.tags || []).map((tag) => ({
      tagFQN: tag.tagFQN,
      isRemovable: true,
    }));
  };

  const fetchTags = () => {
    setIsTagLoading(true);
    getTagCategories()
      .then((res) => {
        setTagList(getTaglist(res.data));
      })
      .finally(() => {
        setIsTagLoading(false);
      });
  };

  const handleTagSelection = (selectedTags?: Array<EntityTags>) => {
    onTagUpdate?.(selectedTags?.map((tag) => tag.tagFQN));
    setIsTagEditable(false);
  };

  const handleRemoveReviewer = (id: string) => {
    let updatedGlossaryTerm = cloneDeep(glossaryTerm);
    const reviewer = updatedGlossaryTerm.reviewers?.filter(
      (reviewer) => reviewer.id !== id
    );
    updatedGlossaryTerm = {
      ...updatedGlossaryTerm,
      reviewers: reviewer,
    };

    handleGlossaryTermUpdate(updatedGlossaryTerm);
  };

  const handleSynonymsSave = () => {
    if (synonyms !== glossaryTerm.synonyms?.join(',')) {
      let updatedGlossaryTerm = cloneDeep(glossaryTerm);
      updatedGlossaryTerm = {
        ...updatedGlossaryTerm,
        synonyms: synonyms.split(','),
      };

      handleGlossaryTermUpdate(updatedGlossaryTerm);
    }
    setIsSynonymsEditing(false);
  };

  const handleReferencesSave = (data: TermReference[]) => {
    if (!isEqual(data, references)) {
      let updatedGlossaryTerm = cloneDeep(glossaryTerm);
      updatedGlossaryTerm = {
        ...updatedGlossaryTerm,
        references: data,
      };

      handleGlossaryTermUpdate(updatedGlossaryTerm);
      setReferences(data);
    }
    setIsReferencesEditing(false);
  };

  const handleValidation = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    if (isHasAccess) {
      return;
    }
    const value = event.target.value;
    const eleName = event.target.name;

    switch (eleName) {
      case 'synonyms': {
        setSynonyms(value);

        break;
      }
    }
  };

  useEffect(() => {
    if (glossaryTerm.reviewers && glossaryTerm.reviewers.length) {
      setReviewer(
        glossaryTerm.reviewers.map((d) => ({
          ...(d as FormatedUsersData),
          type: 'user',
        }))
      );
    } else {
      setReviewer([]);
    }
  }, [glossaryTerm.reviewers]);

  useEffect(() => {
    if (glossaryTerm.relatedTerms && glossaryTerm.relatedTerms.length) {
      setRelatedTerms(
        glossaryTerm.relatedTerms.map((term) => {
          return {
            relatedTerms: (term.displayName || term.name) as string,
            description: term.description ?? '',
          };
        })
      );
    }
  }, [glossaryTerm]);

  const rightPosButton = () => {
    return (
      <NonAdminAction position="bottom" title={TITLE_FOR_NON_ADMIN_ACTION}>
        <Button
          className={classNames('tw-h-8 tw-rounded', {
            'tw-opacity-40': isHasAccess,
          })}
          data-testid="add-new-tag-button"
          size="small"
          theme="primary"
          variant="contained"
          onClick={() => setShowRevieweModal(true)}>
          Add Reviewer
        </Button>
      </NonAdminAction>
    );
  };

  const getReviewerTabData = () => {
    return glossaryTerm.reviewers && glossaryTerm.reviewers.length > 0 ? (
      <div className="tw-grid xxl:tw-grid-cols-4 lg:tw-grid-cols-3 md:tw-grid-cols-2 tw-gap-4">
        {glossaryTerm.reviewers?.map((term) => (
          <UserCard
            isActionVisible
            isIconVisible
            item={{
              name: term.name || '',
              description: term.displayName || '',
              id: term.id,
            }}
            key={term.name}
            onRemove={handleRemoveReviewer}
          />
        ))}
      </div>
    ) : (
      <ErrorPlaceHolder>
        <p className="tw-text-base tw-text-center">No Reviewers.</p>
        <p className="tw-text-lg tw-text-center tw-mt-2">{rightPosButton()}</p>
      </ErrorPlaceHolder>
    );
  };

  return (
    <div className="tw-w-full tw-h-full tw-flex tw-flex-col">
      <div className="tw-flex tw-gap-5 tw-mb-2">
        <div className="tw-font-medium">Synonyms</div>
        <div>
          {isSynonymsEditing ? (
            <div className="tw-flex tw-items-center tw-gap-1">
              <input
                className="tw-form-inputs tw-px-3 tw-py-0.5 tw-w-64"
                data-testid="synonyms"
                id="synonyms"
                name="synonyms"
                placeholder="Enter comma seprated term"
                type="text"
                value={synonyms}
                onChange={handleValidation}
              />
              <div className="tw-flex tw-justify-end" data-testid="buttons">
                <Button
                  className="tw-px-1 tw-py-1 tw-rounded tw-text-sm tw-mr-1"
                  data-testid="cancelAssociatedTag"
                  size="custom"
                  theme="primary"
                  variant="contained"
                  onMouseDown={() => setIsSynonymsEditing(false)}>
                  <i
                    aria-hidden="true"
                    className="fa fa-times tw-w-3.5 tw-h-3.5"
                  />
                </Button>
                <Button
                  className="tw-px-1 tw-py-1 tw-rounded tw-text-sm"
                  data-testid="saveAssociatedTag"
                  size="custom"
                  theme="primary"
                  variant="contained"
                  onMouseDown={handleSynonymsSave}>
                  <i
                    aria-hidden="true"
                    className="fa fa-check tw-w-3.5 tw-h-3.5"
                  />
                </Button>
              </div>
            </div>
          ) : (
            <div className="tw-flex tw-group">
              <span>{synonyms || '--'}</span>
              <div className={classNames('tw-w-5 tw-min-w-max')}>
                <NonAdminAction
                  position="right"
                  title={TITLE_FOR_NON_ADMIN_ACTION}>
                  <button
                    className="tw-opacity-0 tw-ml-2 group-hover:tw-opacity-100 focus:tw-outline-none"
                    data-testid="edit-synonyms"
                    onClick={() => setIsSynonymsEditing(true)}>
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
          )}
        </div>
      </div>

      <div className="tw-flex tw-gap-5 tw-mb-2">
        <div className="tw-font-medium">Reference</div>
        <div className="tw-flex tw-group">
          <div>
            {references && references.length ? (
              <div className="tw-flex">
                {references.map((d, i) => (
                  <>
                    {i > 0 && <span className="tw-mr-2">,</span>}
                    <a
                      className="link-text tw-flex"
                      data-testid="owner-link"
                      href={d?.endpoint}
                      key={i}
                      rel="noopener noreferrer"
                      target="_blank">
                      <>
                        <span
                          className={classNames(
                            'tw-mr-1 tw-inline-block tw-truncate',
                            {
                              'tw-w-52': (d?.name as string).length > 32,
                            }
                          )}
                          title={d?.name as string}>
                          {d?.name}
                        </span>

                        <SVGIcons
                          alt="external-link"
                          className="tw-align-middle"
                          icon="external-link"
                          width="12px"
                        />
                      </>
                    </a>
                  </>
                ))}
              </div>
            ) : (
              '--'
            )}
          </div>
          <div className={classNames('tw-w-5 tw-min-w-max')}>
            <NonAdminAction position="right" title={TITLE_FOR_NON_ADMIN_ACTION}>
              <button
                className="tw-opacity-0 tw-ml-2 group-hover:tw-opacity-100 focus:tw-outline-none"
                data-testid="edit-synonyms"
                onClick={() => setIsReferencesEditing(true)}>
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
      </div>

      <div className="tw-flex tw-gap-11 tw-mb-2">
        <div className="tw-font-medium">Status</div>
        <div>{glossaryTerm.status}</div>
      </div>

      <div className="tw-flex tw-flex-wrap tw-group" data-testid="tags">
        {!isTagEditable && (
          <>
            {glossaryTerm?.tags && glossaryTerm.tags.length > 0 && (
              <>
                <SVGIcons
                  alt="icon-tag"
                  className="tw-mx-1"
                  icon="icon-tag-grey"
                  width="16"
                />
                {glossaryTerm.tags.slice(0, LIST_SIZE).map((tag, index) => (
                  <Tags key={index} startWith="#" tag={tag} type="label" />
                ))}

                {glossaryTerm.tags.slice(LIST_SIZE).length > 0 && (
                  <PopOver
                    html={
                      <>
                        {glossaryTerm.tags
                          .slice(LIST_SIZE)
                          .map((tag, index) => (
                            <p className="tw-text-left" key={index}>
                              <Tags startWith="#" tag={tag} type="label" />
                            </p>
                          ))}
                      </>
                    }
                    position="bottom"
                    theme="light"
                    trigger="click">
                    <span className="tw-cursor-pointer tw-text-xs link-text v-align-sub tw--ml-1">
                      •••
                    </span>
                  </PopOver>
                )}
              </>
            )}
          </>
        )}
        <NonAdminAction
          position="bottom"
          title={TITLE_FOR_NON_ADMIN_ACTION}
          trigger="click">
          <div
            className="tw-inline-block"
            onClick={() => {
              fetchTags();
              setIsTagEditable(true);
            }}>
            <TagsContainer
              dropDownHorzPosRight={false}
              editable={isTagEditable}
              isLoading={isTagLoading}
              selectedTags={getSelectedTags()}
              showTags={false}
              size="small"
              tagList={tagList}
              type="label"
              onCancel={() => {
                handleTagSelection();
              }}
              onSelectionChange={(tags) => {
                handleTagSelection(tags);
              }}>
              {glossaryTerm?.tags && glossaryTerm?.tags.length ? (
                <button className="tw-ml-1 focus:tw-outline-none">
                  <SVGIcons
                    alt="edit"
                    icon="icon-edit"
                    title="Edit"
                    width="12px"
                  />
                </button>
              ) : (
                <span>
                  <Tags
                    className="tw-text-primary"
                    startWith="+ "
                    tag="Add tag"
                    type="label"
                  />
                </span>
              )}
            </TagsContainer>
          </div>
        </NonAdminAction>
      </div>

      <div className="tw--ml-5" data-testid="description-container">
        <Description
          blurWithBodyBG
          removeBlur
          description={glossaryTerm.description || ''}
          entityName={glossaryTerm?.displayName ?? glossaryTerm?.name}
          isEdit={isDescriptionEditable}
          onCancel={onCancel}
          onDescriptionEdit={onDescriptionEdit}
          onDescriptionUpdate={onDescriptionUpdate}
        />
      </div>

      <div className="tw-flex tw-flex-col tw-flex-grow">
        <TabsPane
          activeTab={activeTab}
          className="tw-flex-initial"
          rightPosButton={
            glossaryTerm.reviewers &&
            glossaryTerm.reviewers.length > 0 &&
            activeTab === 3
              ? rightPosButton()
              : undefined
          }
          setActiveTab={activeTabHandler}
          tabs={tabs}
        />

        <div className="tw-flex-grow tw-py-4">
          {activeTab === 1 && <RelationshipTab data={relatedTerms} />}
          {activeTab === 2 && (
            <AssetsTabs
              assetData={assetData}
              onAssetPaginate={onAssetPaginate}
            />
          )}
          {activeTab === 3 && getReviewerTabData()}
        </div>

        {showRevieweModal && (
          <ReviewerModal
            header="Add Reviewer"
            reviewer={reviewer}
            onCancel={onReviewerModalCancel}
            onSave={handleReviewerSave}
          />
        )}
        {isReferencesEditing && (
          <GlossaryReferenceModal
            header={`Edit References for ${glossaryTerm.name}`}
            referenceList={references}
            onCancel={() => setIsReferencesEditing(false)}
            onSave={handleReferencesSave}
          />
        )}
      </div>
    </div>
  );
};

export default GlossaryTermsV1;
