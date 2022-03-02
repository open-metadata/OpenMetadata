import classNames from 'classnames';
import { cloneDeep, includes, isEqual } from 'lodash';
import { EntityTags, FormatedUsersData } from 'Models';
import React, { useEffect, useState } from 'react';
import { TITLE_FOR_NON_ADMIN_ACTION } from '../../constants/constants';
import { Glossary } from '../../generated/entity/data/glossary';
import { Operation } from '../../generated/entity/policies/policy';
import { LabelType, State } from '../../generated/type/tagLabel';
import UserCard from '../../pages/teams/UserCard';
import { getHtmlForNonAdminAction } from '../../utils/CommonUtils';
import SVGIcons from '../../utils/SvgUtils';
import { getTagCategories, getTaglist } from '../../utils/TagsUtils';
import { Button } from '../buttons/Button/Button';
import Avatar from '../common/avatar/Avatar';
import Description from '../common/description/Description';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import TabsPane from '../common/TabsPane/TabsPane';
import ReviewerModal from '../Modals/ReviewerModal/ReviewerModal.component';
import TagsContainer from '../tags-container/tags-container';
import Tags from '../tags/tags';

type props = {
  isHasAccess: boolean;
  glossary: Glossary;
  updateGlossary: (value: Glossary) => void;
};

const GlossaryDetails = ({ isHasAccess, glossary, updateGlossary }: props) => {
  const [activeTab, setActiveTab] = useState(1);
  const [isDescriptionEditable, setIsDescriptionEditable] = useState(false);
  const [isTagEditable, setIsTagEditable] = useState<boolean>(false);
  const [tagList, setTagList] = useState<Array<string>>([]);
  const [isTagLoading, setIsTagLoading] = useState<boolean>(false);

  const [showRevieweModal, setShowRevieweModal] = useState(false);
  const [reviewer, setReviewer] = useState<Array<FormatedUsersData>>([]);

  const tabs = [
    {
      name: 'Reviewer',
      icon: {
        alt: 'schema',
        name: 'icon-schema',
        title: 'Schema',
        selectedName: 'icon-schemacolor',
      },
      isProtected: false,
      position: 1,
    },
  ];

  const onReviewerModalCancel = () => {
    setShowRevieweModal(false);
  };

  const handleReviewerSave = (data: Array<FormatedUsersData>) => {
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

  const setActiveTabHandler = (value: number) => {
    setActiveTab(value);
  };

  useEffect(() => {
    if (glossary.reviewers && glossary.reviewers.length) {
      setReviewer(
        glossary.reviewers.map((d) => ({
          ...(d as FormatedUsersData),
          type: 'user',
        }))
      );
    }
  }, []);

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
          Add New Reviewer
        </Button>
      </NonAdminAction>
    );
  };

  const getReviewerTabData = () => {
    return glossary.reviewers && glossary.reviewers.length > 0 ? (
      <div className="tw-grid xxl:tw-grid-cols-4 lg:tw-grid-cols-3 md:tw-grid-cols-2 tw-gap-4">
        {glossary.reviewers?.map((term) => (
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
        <p className="tw-text-base tw-text-center">No Reviewer Added.</p>
        <p className="tw-text-lg tw-text-center tw-mt-2">{rightPosButton()}</p>
      </ErrorPlaceHolder>
    );
  };

  return (
    <div className="tw-w-full tw-h-full tw-flex tw-flex-col">
      <div className="tw-mb-3 tw-flex tw-items-center">
        {(glossary.owner?.displayName || glossary.owner?.name) && (
          <div className="tw-inline-block tw-mr-2">
            <Avatar
              name={glossary.owner?.displayName || glossary.owner?.name || ''}
              textClass="tw-text-xs"
              width="22"
            />
          </div>
        )}
        <span className="tw-text-grey-muted">
          {glossary.owner?.displayName || 'No owner'}
        </span>
      </div>

      <div className="tw-flex tw-flex-wrap tw-group" data-testid="tags">
        <NonAdminAction
          html={getHtmlForNonAdminAction(Boolean(glossary.owner))}
          isOwner={Boolean(glossary.owner)}
          permission={Operation.UpdateTags}
          position="bottom"
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
              showTags={!isTagEditable}
              size="small"
              tagList={tagList}
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
          description={glossary?.description || ''}
          entityName={glossary?.displayName ?? glossary?.name}
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
            glossary.reviewers &&
            glossary.reviewers.length > 0 &&
            activeTab === 1
              ? rightPosButton()
              : undefined
          }
          setActiveTab={setActiveTabHandler}
          tabs={tabs}
        />

        <div className="tw-flex-grow tw--mx-6 tw-px-7 tw-py-4">
          {activeTab === 1 && getReviewerTabData()}
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
    </div>
  );
};

export default GlossaryDetails;
