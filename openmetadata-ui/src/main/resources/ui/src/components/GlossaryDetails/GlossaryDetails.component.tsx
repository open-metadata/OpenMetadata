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
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { cloneDeep, debounce, includes, isEqual } from 'lodash';
import { EntityTags, FormattedUsersData } from 'Models';
import React, { useCallback, useEffect, useState } from 'react';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import { WILD_CARD_CHAR } from '../../constants/char.constants';
import {
  TITLE_FOR_NON_ADMIN_ACTION,
  TITLE_FOR_NON_OWNER_ACTION,
  TITLE_FOR_UPDATE_OWNER,
} from '../../constants/constants';
import { Glossary } from '../../generated/entity/data/glossary';
import { Operation } from '../../generated/entity/policies/policy';
import { EntityReference } from '../../generated/type/entityReference';
import { LabelType, Source, State } from '../../generated/type/tagLabel';
import { useAuth } from '../../hooks/authHooks';
import jsonData from '../../jsons/en';
import { getEntityName, hasEditAccess } from '../../utils/CommonUtils';
import { getOwnerList } from '../../utils/ManageUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import {
  getTagCategories,
  getTaglist,
  getTagOptionsFromFQN,
} from '../../utils/TagsUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import {
  isCurrentUserAdmin,
  searchFormattedUsersAndTeams,
  suggestFormattedUsersAndTeams,
} from '../../utils/UserDataUtils';
import { Button } from '../buttons/Button/Button';
import Card from '../common/Card/Card';
import DescriptionV1 from '../common/description/DescriptionV1';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import ProfilePicture from '../common/ProfilePicture/ProfilePicture';
import DropDownList from '../dropdown/DropDownList';
import ReviewerModal from '../Modals/ReviewerModal/ReviewerModal.component';
import TagsContainer from '../tags-container/tags-container';
import TagsViewer from '../tags-viewer/tags-viewer';
import Tags from '../tags/tags';

type props = {
  isHasAccess: boolean;
  glossary: Glossary;
  updateGlossary: (value: Glossary) => void;
  handleUserRedirection?: (name: string) => void;
};

const GlossaryDetails = ({ isHasAccess, glossary, updateGlossary }: props) => {
  const { userPermissions } = useAuth();
  const { isAuthDisabled } = useAuthContext();
  const [isDescriptionEditable, setIsDescriptionEditable] = useState(false);
  const [isTagEditable, setIsTagEditable] = useState<boolean>(false);
  const [tagList, setTagList] = useState<Array<string>>([]);
  const [isTagLoading, setIsTagLoading] = useState<boolean>(false);
  const [searchText, setSearchText] = useState<string>('');
  const [listOwners, setListOwners] = useState(getOwnerList());
  const [isUserLoading, setIsUserLoading] = useState<boolean>(false);
  const [listVisible, setListVisible] = useState(false);

  const [showRevieweModal, setShowRevieweModal] = useState(false);
  const [reviewer, setReviewer] = useState<Array<FormattedUsersData>>([]);

  const onReviewerModalCancel = () => {
    setShowRevieweModal(false);
  };

  const handleReviewerSave = (data: Array<FormattedUsersData>) => {
    if (!isEqual(data, reviewer)) {
      let updatedGlossary = cloneDeep(glossary);
      const oldReviewer = data.filter((d) => includes(reviewer, d));
      const newReviewer = data
        .filter((d) => !includes(reviewer, d))
        .map((d) => ({ id: d.id, type: d.type }));
      updatedGlossary = {
        ...updatedGlossary,
        reviewers: [...oldReviewer, ...newReviewer],
      };
      setReviewer(data);
      updateGlossary(updatedGlossary);
    }
    onReviewerModalCancel();
  };

  const onTagUpdate = (selectedTags?: Array<string>) => {
    if (selectedTags) {
      const prevTags =
        glossary?.tags?.filter((tag) =>
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
      const updatedGlossary = { ...glossary, tags: updatedTags };
      updateGlossary(updatedGlossary);
    }
  };
  const handleTagSelection = (selectedTags?: Array<EntityTags>) => {
    onTagUpdate?.(selectedTags?.map((tag) => tag.tagFQN));
    setIsTagEditable(false);
  };

  const onDescriptionEdit = (): void => {
    setIsDescriptionEditable(true);
  };
  const onCancel = () => {
    setIsDescriptionEditable(false);
  };

  const handleSelectOwnerDropdown = () => {
    setListVisible((visible) => !visible);
  };

  const getOwnerSearch = useCallback(
    (searchQuery = WILD_CARD_CHAR, from = 1) => {
      setIsUserLoading(true);
      searchFormattedUsersAndTeams(searchQuery, from)
        .then((res) => {
          const { users, teams } = res;
          setListOwners(getOwnerList(users, teams));
        })
        .catch(() => {
          setListOwners([]);
        })
        .finally(() => {
          setIsUserLoading(false);
        });
    },
    [setListOwners, setIsUserLoading]
  );

  const getOwnerSuggestion = useCallback(
    (qSearchText = '') => {
      setIsUserLoading(true);
      suggestFormattedUsersAndTeams(qSearchText)
        .then((res) => {
          const { users, teams } = res;
          setListOwners(getOwnerList(users, teams));
        })
        .catch(() => {
          setListOwners([]);
        })
        .finally(() => {
          setIsUserLoading(false);
        });
    },
    [setListOwners, setIsUserLoading]
  );

  const debouncedOnChange = useCallback(
    (text: string): void => {
      if (text) {
        getOwnerSuggestion(text);
      } else {
        getOwnerSearch();
      }
    },
    [getOwnerSuggestion, getOwnerSearch]
  );

  const debounceOnSearch = useCallback(debounce(debouncedOnChange, 400), [
    debouncedOnChange,
  ]);

  const handleOwnerSearch = (text: string) => {
    setSearchText(text);
    debounceOnSearch(text);
  };

  const getSelectedTags = () => {
    return (glossary.tags || []).map((tag) => ({
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
      .catch((err: AxiosError) => {
        showErrorToast(err, jsonData['api-error-messages']['fetch-tags-error']);
      })
      .finally(() => {
        setIsTagLoading(false);
      });
  };

  const onDescriptionUpdate = (updatedHTML: string) => {
    if (glossary.description !== updatedHTML) {
      const updatedTableDetails = {
        ...glossary,
        description: updatedHTML,
      };
      updateGlossary(updatedTableDetails);
      setIsDescriptionEditable(false);
    } else {
      setIsDescriptionEditable(false);
    }
  };

  const handleRemoveReviewer = (id: string) => {
    let updatedGlossary = cloneDeep(glossary);
    const reviewer = updatedGlossary.reviewers?.filter(
      (glossary) => glossary.id !== id
    );
    updatedGlossary = {
      ...updatedGlossary,
      reviewers: reviewer,
    };

    updateGlossary(updatedGlossary);
  };

  const prepareOwner = (updatedOwner?: EntityReference) => {
    return !isEqual(updatedOwner, glossary.owner) ? updatedOwner : undefined;
  };

  const handleOwnerSelection = (
    _e: React.MouseEvent<HTMLElement, MouseEvent>,
    value = ''
  ) => {
    const owner = listOwners.find((item) => item.value === value);

    if (owner) {
      const newOwner = prepareOwner({ type: owner.type, id: owner.value });
      if (newOwner) {
        const updatedData = {
          ...glossary,
          owner: newOwner,
        };
        updateGlossary(updatedData);
      }
    }
    setListVisible(false);
  };

  const isOwner = () => {
    return hasEditAccess(
      glossary?.owner?.type || '',
      glossary?.owner?.id || ''
    );
  };

  const handleTagContainerClick = () => {
    if (!isTagEditable) {
      fetchTags();
      setIsTagEditable(true);
    }
  };

  useEffect(() => {
    if (glossary.reviewers && glossary.reviewers.length) {
      setReviewer(
        glossary.reviewers.map((d) => ({
          ...(d as FormattedUsersData),
          type: 'user',
        }))
      );
    } else {
      setReviewer([]);
    }
  }, [glossary.reviewers]);

  const AddReviewerButton = () => {
    return (
      <NonAdminAction position="bottom" title={TITLE_FOR_NON_ADMIN_ACTION}>
        <button
          className="tw-text-primary"
          data-testid="add-new-reviewer"
          disabled={isHasAccess}
          onClick={() => setShowRevieweModal(true)}>
          <SVGIcons alt="edit" icon={Icons.EDIT} title="Edit" width="16px" />
        </button>
      </NonAdminAction>
    );
  };

  const ownerAction = () => {
    return (
      <span className="tw-relative">
        <NonAdminAction
          html={<p>{TITLE_FOR_UPDATE_OWNER}</p>}
          isOwner={isOwner()}
          permission={Operation.EditOwner}
          position="left">
          <Button
            data-testid="owner-dropdown"
            disabled={
              !userPermissions[Operation.EditOwner] &&
              !isAuthDisabled &&
              !hasEditAccess
            }
            size="custom"
            theme="primary"
            variant="text"
            onClick={handleSelectOwnerDropdown}>
            <SVGIcons alt="edit" icon={Icons.EDIT} title="Edit" width="16px" />
          </Button>
        </NonAdminAction>
        {listVisible && (
          <DropDownList
            horzPosRight
            showEmptyList
            controlledSearchStr={searchText}
            dropDownList={listOwners}
            groupType="tab"
            isLoading={isUserLoading}
            listGroups={['Teams', 'Users']}
            showSearchBar={isCurrentUserAdmin()}
            value={glossary.owner?.id || ''}
            onSearchTextChange={handleOwnerSearch}
            onSelect={handleOwnerSelection}
          />
        )}
      </span>
    );
  };

  const getReviewerTabData = () => {
    return (
      <div className="tw--mx-5">
        {glossary.reviewers && glossary.reviewers.length > 0 ? (
          <div className="tw-flex tw-flex-col tw-gap-4">
            {glossary.reviewers.map((term, i) => (
              <div
                className={classNames(
                  'tw-flex tw-justify-between tw-items-center tw-px-5',
                  {
                    'tw-border-b tw-pb-2 tw-border-border-lite':
                      i !== (glossary.reviewers || []).length - 1,
                  }
                )}
                key={i}>
                <div className={classNames('tw-flex tw-items-center')}>
                  <div className="tw-inline-block tw-mr-2">
                    <ProfilePicture
                      displayName={getEntityName(term)}
                      id={term.id}
                      name={term?.name || ''}
                      textClass="tw-text-xs"
                      width="25"
                    />
                  </div>

                  <span>{getEntityName(term)}</span>
                </div>
                <span>
                  <NonAdminAction
                    html={<p>{TITLE_FOR_NON_OWNER_ACTION}</p>}
                    isOwner={isOwner()}
                    position="bottom">
                    <span
                      className={classNames('tw-h-8 tw-rounded tw-mb-3')}
                      data-testid="remove"
                      onClick={() => handleRemoveReviewer(term.id)}>
                      <FontAwesomeIcon
                        className="tw-cursor-pointer"
                        icon="remove"
                      />
                    </span>
                  </NonAdminAction>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="tw-text-grey-muted tw-mx-5 tw-text-center">
            No reviewer
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="tw-w-full tw-h-full tw-flex tw-flex-col"
      data-testid="glossary-details">
      <div className="tw-flex tw-flex-wrap tw-group tw-mb-5" data-testid="tags">
        {!isTagEditable && (
          <>
            {glossary?.tags && glossary.tags.length > 0 && (
              <>
                <SVGIcons
                  alt="icon-tag"
                  className="tw-mx-1"
                  icon="icon-tag-grey"
                  width="16"
                />
                <TagsViewer tags={glossary.tags} />
              </>
            )}
          </>
        )}
        <NonAdminAction
          isOwner={Boolean(glossary.owner)}
          permission={Operation.EditTags}
          position="bottom"
          title={TITLE_FOR_NON_OWNER_ACTION}
          trigger="click">
          <div className="tw-inline-block" onClick={handleTagContainerClick}>
            <TagsContainer
              buttonContainerClass="tw--mt-0"
              containerClass="tw-flex tw-items-center tw-gap-2"
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
              {glossary?.tags && glossary?.tags.length ? (
                <button className=" tw-ml-1 focus:tw-outline-none">
                  <SVGIcons
                    alt="edit"
                    icon="icon-edit"
                    title="Edit"
                    width="16px"
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
      <div className="tw-flex tw-gap-3">
        <div className="tw-w-9/12">
          <div className="tw-mb-4" data-testid="description-container">
            <DescriptionV1
              removeBlur
              description={glossary?.description}
              entityName={glossary?.displayName ?? glossary?.name}
              isEdit={isDescriptionEditable}
              onCancel={onCancel}
              onDescriptionEdit={onDescriptionEdit}
              onDescriptionUpdate={onDescriptionUpdate}
            />
          </div>
        </div>
        <div className="tw-w-3/12 tw-px-2">
          <Card action={ownerAction()} heading="Owner">
            <div className="tw-flex tw-items-center">
              {glossary.owner && getEntityName(glossary.owner) && (
                <div className="tw-inline-block tw-mr-2">
                  <ProfilePicture
                    displayName={getEntityName(glossary.owner)}
                    id={glossary.owner?.id || ''}
                    name={glossary.owner?.name || ''}
                    textClass="tw-text-xs"
                    width="25"
                  />
                </div>
              )}
              {glossary.owner && getEntityName(glossary.owner) ? (
                <span>{getEntityName(glossary.owner)}</span>
              ) : (
                <span className="tw-text-grey-muted">No owner</span>
              )}
            </div>
          </Card>
          <Card
            action={AddReviewerButton()}
            className="tw-mt-4"
            heading="Reviewer">
            <div>{getReviewerTabData()}</div>
          </Card>
        </div>
      </div>

      {showRevieweModal && (
        <ReviewerModal
          header="Add Reviewer"
          reviewer={reviewer}
          onCancel={onReviewerModalCancel}
          onSave={handleReviewerSave}
        />
      )}
    </div>
  );
};

export default GlossaryDetails;
