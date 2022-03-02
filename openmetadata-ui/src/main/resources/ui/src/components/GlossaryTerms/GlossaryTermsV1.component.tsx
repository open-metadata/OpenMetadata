import classNames from 'classnames';
import { cloneDeep, includes, isEmpty, isEqual } from 'lodash';
import { EntityTags, FormatedUsersData } from 'Models';
import React, { useEffect, useState } from 'react';
import { TITLE_FOR_NON_ADMIN_ACTION } from '../../constants/constants';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { LabelType, State } from '../../generated/type/tagLabel';
import UserCard from '../../pages/teams/UserCard';
import SVGIcons from '../../utils/SvgUtils';
import { getTagCategories, getTaglist } from '../../utils/TagsUtils';
import { Button } from '../buttons/Button/Button';
import Description from '../common/description/Description';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import TabsPane from '../common/TabsPane/TabsPane';
import ReviewerModal from '../Modals/ReviewerModal/ReviewerModal.component';
import TagsContainer from '../tags-container/tags-container';
import Tags from '../tags/tags';
import AssetsTabs from './tabs/AssetsTabs.component';
import RelationshipTab from './tabs/RelationshipTab.component';
type Props = {
  isHasAccess: boolean;
  glossaryTerm: GlossaryTerm;
  handleGlossaryTermUpdate: (data: GlossaryTerm) => void;
};

const GlossaryTermsV1 = ({
  isHasAccess,
  glossaryTerm,
  handleGlossaryTermUpdate,
}: Props) => {
  const [isTagEditable, setIsTagEditable] = useState<boolean>(false);
  const [tagList, setTagList] = useState<Array<string>>([]);
  const [isTagLoading, setIsTagLoading] = useState<boolean>(false);
  const [isDescriptionEditable, setIsDescriptionEditable] = useState(false);
  const [activeTab, setActiveTab] = useState(1);
  const [showRevieweModal, setShowRevieweModal] = useState(false);
  const [reviewer, setReviewer] = useState<Array<FormatedUsersData>>([]);

  const tabs = [
    {
      name: 'Related Terms',
      icon: {
        alt: 'schema',
        name: 'icon-schema',
        title: 'Schema',
        selectedName: 'icon-schemacolor',
      },
      isProtected: false,
      position: 1,
    },
    {
      name: 'Assets',
      icon: {
        alt: 'schema',
        name: 'icon-schema',
        title: 'Schema',
        selectedName: 'icon-schemacolor',
      },
      isProtected: false,
      position: 2,
    },
    {
      name: 'Reviewer',
      icon: {
        alt: 'schema',
        name: 'icon-schema',
        title: 'Schema',
        selectedName: 'icon-schemacolor',
      },
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

  useEffect(() => {
    if (glossaryTerm.reviewers && glossaryTerm.reviewers.length) {
      setReviewer(
        glossaryTerm.reviewers.map((d) => ({
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
        <p className="tw-text-base tw-text-center">No Reviewer Added.</p>
        <p className="tw-text-lg tw-text-center tw-mt-2">{rightPosButton()}</p>
      </ErrorPlaceHolder>
    );
  };

  return (
    <div className="tw-w-full tw-h-full tw-flex tw-flex-col">
      <div className="tw-flex tw-gap-5 tw-mb-2">
        <div className="tw-font-medium">Synonyms</div>
        <div>
          {glossaryTerm.synonyms && glossaryTerm.synonyms?.length > 0 ? (
            <span>{glossaryTerm.synonyms.join(', ')}</span>
          ) : (
            '--'
          )}
        </div>
      </div>

      <div className="tw-flex tw-gap-5 tw-mb-2">
        <div className="tw-font-medium">Reference</div>
        <div>
          {!isEmpty(glossaryTerm.references) ? (
            <a
              className="link-text tw-flex"
              data-testid="owner-link"
              href={glossaryTerm.references?.endpoint}
              rel="noopener noreferrer"
              target="_blank">
              <>
                <span
                  className={classNames('tw-mr-1 tw-inline-block tw-truncate', {
                    'tw-w-52':
                      (glossaryTerm.references?.name as string).length > 32,
                  })}
                  title={glossaryTerm.references?.name as string}>
                  {glossaryTerm.references?.name}
                </span>

                <SVGIcons
                  alt="external-link"
                  className="tw-align-middle"
                  icon="external-link"
                  width="12px"
                />
              </>
            </a>
          ) : (
            '--'
          )}
        </div>
      </div>

      <div className="tw-flex tw-gap-5 tw-mb-2">
        <div className="tw-font-medium">Status</div>
        <div>{glossaryTerm.status}</div>
      </div>

      <div className="tw-flex tw-flex-wrap tw-group" data-testid="tags">
        {glossaryTerm?.tags && glossaryTerm?.tags.length > 0 && (
          <SVGIcons
            alt="icon-tag"
            className="tw-mx-1"
            icon="icon-tag-grey"
            width="16"
          />
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
          {activeTab === 1 && <RelationshipTab />}
          {activeTab === 2 && <AssetsTabs />}
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
      </div>
    </div>
  );
};

export default GlossaryTermsV1;
