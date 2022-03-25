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
import { cloneDeep, includes, isEqual } from 'lodash';
import {
  EntityTags,
  FormattedGlossaryTermData,
  FormattedUsersData,
  GlossaryTermAssets,
} from 'Models';
import React, { Fragment, useEffect, useState } from 'react';
import { TITLE_FOR_NON_ADMIN_ACTION } from '../../constants/constants';
import {
  GlossaryTerm,
  TermReference,
} from '../../generated/entity/data/glossaryTerm';
import { LabelType, Source, State } from '../../generated/type/tagLabel';
import UserCard from '../../pages/teams/UserCard';
import SVGIcons from '../../utils/SvgUtils';
import {
  getTagCategories,
  getTaglist,
  getTagOptionsFromFQN,
} from '../../utils/TagsUtils';
import { Button } from '../buttons/Button/Button';
import Description from '../common/description/Description';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import TabsPane from '../common/TabsPane/TabsPane';
import GlossaryReferenceModal from '../Modals/GlossaryReferenceModal/GlossaryReferenceModal';
import RelatedTermsModal from '../Modals/RelatedTermsModal/RelatedTermsModal';
import ReviewerModal from '../Modals/ReviewerModal/ReviewerModal.component';
import TagsContainer from '../tags-container/tags-container';
import TagsViewer from '../tags-viewer/tags-viewer';
import Tags from '../tags/tags';
import AssetsTabs from './tabs/AssetsTabs.component';
import RelationshipTab from './tabs/RelationshipTab.component';
type Props = {
  assetData: GlossaryTermAssets;
  isHasAccess: boolean;
  glossaryTerm: GlossaryTerm;
  handleGlossaryTermUpdate: (data: GlossaryTerm) => void;
  onAssetPaginate: (num: number) => void;
  onRelatedTermClick?: (fqn: string) => void;
};

const GlossaryTermsV1 = ({
  assetData,
  isHasAccess,
  glossaryTerm,
  handleGlossaryTermUpdate,
  onAssetPaginate,
  onRelatedTermClick,
}: Props) => {
  const [isTagEditable, setIsTagEditable] = useState<boolean>(false);
  const [tagList, setTagList] = useState<Array<string>>([]);
  const [isTagLoading, setIsTagLoading] = useState<boolean>(false);
  const [isDescriptionEditable, setIsDescriptionEditable] = useState(false);
  const [activeTab, setActiveTab] = useState(1);
  const [showRevieweModal, setShowRevieweModal] = useState(false);
  const [showRelatedTermsModal, setShowRelatedTermsModal] = useState(false);
  const [isSynonymsEditing, setIsSynonymsEditing] = useState(false);
  const [isReferencesEditing, setIsReferencesEditing] = useState(false);
  const [synonyms, setSynonyms] = useState(
    glossaryTerm.synonyms?.join(',') || ''
  );
  const [references, setReferences] = useState(glossaryTerm.references || []);
  const [reviewer, setReviewer] = useState<Array<FormattedUsersData>>([]);
  const [relatedTerms, setRelatedTerms] = useState<FormattedGlossaryTermData[]>(
    []
  );

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

  const onRelatedTermsModalCancel = () => {
    setShowRelatedTermsModal(false);
  };

  const handleRelatedTermsSave = (terms: Array<FormattedGlossaryTermData>) => {
    if (!isEqual(terms, relatedTerms)) {
      let updatedGlossaryTerm = cloneDeep(glossaryTerm);
      const oldTerms = terms.filter((d) => includes(relatedTerms, d));
      const newTerms = terms
        .filter((d) => !includes(relatedTerms, d))
        .map((d) => ({
          id: d.id,
          type: d.type,
          displayName: d.displayName,
          name: d.name,
        }));
      updatedGlossaryTerm = {
        ...updatedGlossaryTerm,
        relatedTerms: [...oldTerms, ...newTerms],
      };
      setRelatedTerms(terms);
      handleGlossaryTermUpdate(updatedGlossaryTerm);
    }
    onRelatedTermsModalCancel();
  };

  const onReviewerModalCancel = () => {
    setShowRevieweModal(false);
  };

  const handleReviewerSave = (data: Array<FormattedUsersData>) => {
    if (!isEqual(data, reviewer)) {
      let updatedGlossaryTerm = cloneDeep(glossaryTerm);
      const oldReviewer = data.filter((d) => includes(reviewer, d));
      const newReviewer = data
        .filter((d) => !includes(reviewer, d))
        .map((d) => ({
          id: d.id,
          type: d.type,
          displayName: d.displayName,
          name: d.name,
        }));
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
          source: Source.Tag,
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
          ...(d as FormattedUsersData),
          type: 'user',
        }))
      );
    } else {
      setReviewer([]);
    }
  }, [glossaryTerm.reviewers]);

  useEffect(() => {
    if (glossaryTerm.relatedTerms?.length) {
      setRelatedTerms(glossaryTerm.relatedTerms as FormattedGlossaryTermData[]);
    }
  }, [glossaryTerm.relatedTerms]);

  const AddReviewerButton = () => {
    return (
      <NonAdminAction position="bottom" title={TITLE_FOR_NON_ADMIN_ACTION}>
        <Button
          className={classNames('tw-h-8 tw-rounded', {
            'tw-opacity-40': isHasAccess,
          })}
          data-testid="add-new-reviewer"
          size="small"
          theme="primary"
          variant="contained"
          onClick={() => setShowRevieweModal(true)}>
          Add Reviewer
        </Button>
      </NonAdminAction>
    );
  };

  const AddRelatedTermButton = () => {
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
          onClick={() => setShowRelatedTermsModal(true)}>
          Add Related Term
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
      <div className="tw-py-3 tw-text-center tw-bg-white tw-border tw-border-main">
        <p className="tw-mb-3">No reviewers assigned</p>
        <p>{AddReviewerButton()}</p>
      </div>
    );
  };

  const getTabPaneButton = () => {
    switch (activeTab) {
      case 1: {
        return relatedTerms.length ? AddRelatedTermButton() : undefined;
      }
      case 3: {
        return glossaryTerm.reviewers?.length ? AddReviewerButton() : undefined;
      }
      default:
        return;
    }
  };

  return (
    <div
      className="tw-w-full tw-h-full tw-flex tw-flex-col"
      data-testid="glossary-term">
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
                  <FontAwesomeIcon className="tw-w-3.5 tw-h-3.5" icon="times" />
                </Button>
                <Button
                  className="tw-px-1 tw-py-1 tw-rounded tw-text-sm"
                  data-testid="saveAssociatedTag"
                  size="custom"
                  theme="primary"
                  variant="contained"
                  onMouseDown={handleSynonymsSave}>
                  <FontAwesomeIcon className="tw-w-3.5 tw-h-3.5" icon="check" />
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
        <div className="tw-font-medium">References</div>
        <div className="tw-flex tw-group">
          <div>
            {references && references.length ? (
              <div className="tw-flex">
                {references.map((d, i) => (
                  <Fragment key={i}>
                    {i > 0 && <span className="tw-mr-2">,</span>}
                    <a
                      className="link-text tw-flex"
                      data-testid="owner-link"
                      href={d?.endpoint}
                      rel="noopener noreferrer"
                      target="_blank">
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
                    </a>
                  </Fragment>
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

      {/* TODO: Add this stat when supporting status updation  */}
      {/* <div className="tw-flex tw-gap-11 tw-mb-2">
        <div className="tw-font-medium">Status</div>
        <div>{glossaryTerm.status}</div>
      </div> */}

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
                <TagsViewer tags={glossaryTerm.tags} />
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
              tagList={getTagOptionsFromFQN(tagList)}
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
          rightPosButton={getTabPaneButton()}
          setActiveTab={activeTabHandler}
          tabs={tabs}
        />

        <div className="tw-flex-grow tw-py-4">
          {activeTab === 1 && (
            <RelationshipTab
              addButton={<>{AddRelatedTermButton()}</>}
              data={relatedTerms}
              onRelatedTermClick={onRelatedTermClick}
            />
          )}
          {activeTab === 2 && (
            <AssetsTabs
              assetData={assetData}
              onAssetPaginate={onAssetPaginate}
            />
          )}
          {activeTab === 3 && getReviewerTabData()}
        </div>

        {showRelatedTermsModal && (
          <RelatedTermsModal
            glossaryTermFQN={glossaryTerm.fullyQualifiedName}
            header="Add Related Terms"
            relatedTerms={relatedTerms}
            onCancel={onRelatedTermsModalCancel}
            onSave={handleRelatedTermsSave}
          />
        )}
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
