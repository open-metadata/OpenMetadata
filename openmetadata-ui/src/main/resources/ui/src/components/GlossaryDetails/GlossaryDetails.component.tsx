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

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button as ButtonAntd, Col, Row, Space, Tooltip } from 'antd';
import classNames from 'classnames';
import GlossaryHeader from 'components/Glossary/GlossaryHeader/GlossaryHeader.component';
import GlossaryTermTab from 'components/Glossary/GlossaryTermTab/GlossaryTermTab.component';
import Tags from 'components/Tag/Tags/tags';
import { t } from 'i18next';
import { cloneDeep, debounce, includes, isEqual } from 'lodash';
import { EntityTags } from 'Models';
import React, { useCallback, useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { WILD_CARD_CHAR } from '../../constants/char.constants';
import { NO_PERMISSION_FOR_ACTION } from '../../constants/HelperTextUtil';
import { Glossary } from '../../generated/entity/data/glossary';
import { EntityReference } from '../../generated/type/entityReference';
import { LabelType, State, TagSource } from '../../generated/type/tagLabel';
import { getEntityName } from '../../utils/CommonUtils';
import { getOwnerList } from '../../utils/ManageUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import {
  getAllTagsForOptions,
  getTagOptionsFromFQN,
} from '../../utils/TagsUtils';
import {
  isCurrentUserAdmin,
  searchFormattedUsersAndTeams,
  suggestFormattedUsersAndTeams,
} from '../../utils/UserDataUtils';
import ProfilePicture from '../common/ProfilePicture/ProfilePicture';
import DropDownList from '../dropdown/DropDownList';
import ReviewerModal from '../Modals/ReviewerModal/ReviewerModal.component';
import { OperationPermission } from '../PermissionProvider/PermissionProvider.interface';
import TagsContainer from '../Tag/TagsContainer/tags-container';
import TagsViewer from '../Tag/TagsViewer/tags-viewer';
import './GlossaryDetails.style.less';

type props = {
  permissions: OperationPermission;
  glossary: Glossary;
  updateGlossary: (value: Glossary) => Promise<void>;
};

const GlossaryDetails = ({ permissions, glossary, updateGlossary }: props) => {
  const { glossaryName: glossaryFqn } = useParams<{ glossaryName: string }>();
  const history = useHistory();

  const [isDescriptionEditable, setIsDescriptionEditable] = useState(false);
  const [isTagEditable, setIsTagEditable] = useState<boolean>(false);
  const [tagList, setTagList] = useState<Array<string>>([]);
  const [isTagLoading, setIsTagLoading] = useState<boolean>(false);
  const [searchText, setSearchText] = useState<string>('');
  const [listOwners, setListOwners] = useState(getOwnerList());
  const [isUserLoading, setIsUserLoading] = useState<boolean>(false);
  const [listVisible, setListVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('glossaryTerms');

  const [showRevieweModal, setShowRevieweModal] = useState(false);
  const [reviewer, setReviewer] = useState<Array<EntityReference>>([]);

  const onReviewerModalCancel = () => {
    setShowRevieweModal(false);
  };

  const handleReviewerSave = (data: Array<EntityReference>) => {
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
          source: TagSource.Tag,
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

  const getOwnerSearch = useCallback(
    (searchQuery = WILD_CARD_CHAR, from = 1) => {
      setIsUserLoading(true);
      searchFormattedUsersAndTeams(searchQuery, from)
        .then((res) => {
          const { users, teams } = res;
          setListOwners(getOwnerList(users, teams, false, searchQuery));
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
  const handleSelectOwnerDropdown = () => {
    setListVisible((visible) => {
      const newState = !visible;

      if (newState) {
        getOwnerSearch();
      }

      return newState;
    });
  };
  const getOwnerSuggestion = useCallback(
    (qSearchText = '') => {
      setIsUserLoading(true);
      suggestFormattedUsersAndTeams(qSearchText)
        .then((res) => {
          const { users, teams } = res;
          setListOwners(getOwnerList(users, teams, false, qSearchText));
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

  const fetchTags = async () => {
    setIsTagLoading(true);
    const tags = await getAllTagsForOptions();
    setTagList(tags.map((t) => t.fullyQualifiedName ?? t.name));
    setIsTagLoading(false);
  };

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (glossary.description !== updatedHTML) {
      const updatedTableDetails = {
        ...glossary,
        description: updatedHTML,
      };
      await updateGlossary(updatedTableDetails);
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
      const newOwner = prepareOwner({
        type: owner.type,
        id: owner.value || '',
      });
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
          ...d,
          type: 'user',
        }))
      );
    } else {
      setReviewer([]);
    }
  }, [glossary.reviewers]);

  useEffect(() => {
    setActiveTab('glossaryTerms');
  }, [glossaryFqn]);

  const AddReviewerButton = () => {
    return (
      <Tooltip
        placement="topRight"
        title={permissions.EditAll ? 'Add Reviewer' : NO_PERMISSION_FOR_ACTION}>
        <ButtonAntd
          className="tw-p-0 flex-center"
          data-testid="add-new-reviewer"
          disabled={!permissions.EditAll}
          size="small"
          type="text"
          onClick={() => setShowRevieweModal(true)}>
          <SVGIcons
            alt="edit"
            icon={Icons.IC_EDIT_PRIMARY}
            title="Edit"
            width="16px"
          />
        </ButtonAntd>
      </Tooltip>
    );
  };

  const ownerAction = () => {
    return (
      <span className="tw-relative">
        <Tooltip
          placement="topRight"
          title={
            permissions.EditAll || permissions.EditOwner
              ? 'Update Owner'
              : NO_PERMISSION_FOR_ACTION
          }>
          <ButtonAntd
            className="tw-p-0 flex-center"
            data-testid="owner-dropdown"
            disabled={!(permissions.EditOwner || permissions.EditAll)}
            size="small"
            type="text"
            onClick={handleSelectOwnerDropdown}>
            <SVGIcons
              alt="edit"
              icon={Icons.IC_EDIT_PRIMARY}
              title="Edit"
              width="16px"
            />
          </ButtonAntd>
        </Tooltip>
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
                  <Tooltip
                    title={
                      permissions.EditAll
                        ? 'Remove Reviewer'
                        : NO_PERMISSION_FOR_ACTION
                    }>
                    <ButtonAntd disabled={!permissions.EditAll} type="text">
                      <span
                        className={classNames('tw-h-8 tw-rounded tw-mb-3')}
                        data-testid="remove"
                        onClick={() => handleRemoveReviewer(term.id)}>
                        <FontAwesomeIcon
                          className="tw-cursor-pointer"
                          icon="remove"
                        />
                      </span>
                    </ButtonAntd>
                  </Tooltip>
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
    <Row data-testid="glossary-details" gutter={[0, 16]}>
      <Col span={24}>
        <GlossaryHeader
          permissions={permissions}
          selectedData={glossary}
          onUpdate={updateGlossary}
        />
      </Col>

      <Col span={24}>
        <Space className="items-center flex-wrap" data-testid="tags">
          {!isTagEditable && glossary?.tags && glossary.tags.length > 0 && (
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

          <div className="inline-block" onClick={handleTagContainerClick}>
            <TagsContainer
              buttonContainerClass="tw-mt-0"
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
                <button
                  className=" tw-ml-1 focus:tw-outline-none flex-center"
                  disabled={!(permissions.EditTags || permissions.EditAll)}>
                  <SVGIcons
                    alt="edit"
                    icon="icon-edit"
                    title="Edit"
                    width="16px"
                  />
                </button>
              ) : (
                <ButtonAntd
                  className="tw-p-0"
                  disabled={!(permissions.EditTags || permissions.EditAll)}
                  type="text">
                  <Tags
                    className="tw-text-primary"
                    startWith="+ "
                    tag="Add tag"
                    type="label"
                  />
                </ButtonAntd>
              )}
            </TagsContainer>
          </div>
        </Space>
      </Col>

      <Col span={24}>
        <GlossaryTermTab
          glossaryId={glossary.id}
          selectedGlossaryFqn={glossary.fullyQualifiedName || glossary.name}
        />
      </Col>
      <ReviewerModal
        header={t('label.add-entity', {
          entity: t('label.reviewer'),
        })}
        reviewer={reviewer}
        visible={showRevieweModal}
        onCancel={onReviewerModalCancel}
        onSave={handleReviewerSave}
      />
    </Row>
  );
};

export default GlossaryDetails;
