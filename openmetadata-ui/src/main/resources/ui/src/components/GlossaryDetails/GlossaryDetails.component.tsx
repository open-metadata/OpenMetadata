import { cloneDeep } from 'lodash';
import { EntityTags } from 'Models';
import React, { useState } from 'react';
import { Glossary } from '../../generated/entity/data/glossary';
import { Operation } from '../../generated/entity/policies/policy';
import { LabelType, State } from '../../generated/type/tagLabel';
import UserCard from '../../pages/teams/UserCard';
import { getHtmlForNonAdminAction } from '../../utils/CommonUtils';
import SVGIcons from '../../utils/SvgUtils';
import { getTagCategories, getTaglist } from '../../utils/TagsUtils';
import Description from '../common/description/Description';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import TabsPane from '../common/TabsPane/TabsPane';
import TagsContainer from '../tags-container/tags-container';
import Tags from '../tags/tags';

type props = {
  glossary: Glossary;
  updateGlossaryDescription: (value: Glossary) => void;
  updateReviewer: (value: Glossary) => void;
};

const GlossaryDetails = ({
  glossary,
  updateGlossaryDescription,
  updateReviewer,
}: props) => {
  const [activeTab, setActiveTab] = useState(1);
  //   const [tags, setTags] = useState(glossary.tags);
  const [isDescriptionEditable, setIsDescriptionEditable] = useState(false);
  const [isTagEditable, setIsTagEditable] = useState<boolean>(false);

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
      updateReviewer(updatedGlossary);
    }
  };
  const handleTagSelection = (selectedTags?: Array<EntityTags>) => {
    onTagUpdate?.(selectedTags?.map((tag) => tag.tagFQN));
    setIsTagEditable(false);
  };
  const [tagList, setTagList] = useState<Array<string>>([]);
  const [isTagLoading, setIsTagLoading] = useState<boolean>(false);

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
      updateGlossaryDescription(updatedTableDetails);
      setIsDescriptionEditable(false);
    } else {
      setIsDescriptionEditable(false);
    }
  };

  const handleRemoveReviewer = (id: string) => {
    let updatedGlossary = cloneDeep(glossary);
    const reviewer = updatedGlossary.reviewers?.filter((name) => name !== id);
    updatedGlossary = {
      ...updatedGlossary,
      reviewers: reviewer,
    };

    updateReviewer(updatedGlossary);
  };

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

  const setActiveTabHandler = (value: number) => {
    setActiveTab(value);
  };

  return (
    <div className="tw-w-full tw-h-full tw-flex tw-flex-col">
      <div className="tw-mb-3">
        <span className="tw-text-grey-muted">
          {glossary.owner?.name || 'No owner'}
        </span>
      </div>

      <div className="tw-mb-3 tw--ml-5" data-testid="description-container">
        <Description
          blurWithBodyBG
          description={glossary?.description || ''}
          entityName={glossary?.displayName ?? glossary?.name}
          isEdit={isDescriptionEditable}
          onCancel={onCancel}
          onDescriptionEdit={onDescriptionEdit}
          onDescriptionUpdate={onDescriptionUpdate}
        />
      </div>

      <div
        className="tw-flex tw-flex-wrap tw-pt-1 tw-ml-7 tw-group"
        data-testid="tags">
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
              editable={isTagEditable}
              isLoading={isTagLoading}
              selectedTags={getSelectedTags()}
              showTags={!isTagEditable}
              size="small"
              tagList={tagList}
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

      <div className="tw-mt-4 tw-flex tw-flex-col tw-flex-grow">
        <TabsPane
          activeTab={activeTab}
          className="tw-flex-initial"
          setActiveTab={setActiveTabHandler}
          tabs={tabs}
        />

        <div className="tw-flex-grow tw--mx-6 tw-px-7 tw-py-4">
          {activeTab === 1 && (
            <div className="tw-grid xxl:tw-grid-cols-4 lg:tw-grid-cols-3 md:tw-grid-cols-2 tw-gap-4">
              {glossary.reviewers?.map((name) => (
                <UserCard
                  isActionVisible
                  isIconVisible
                  item={{
                    name: '',
                    description: name,
                    id: name,
                  }}
                  key={name}
                  onRemove={handleRemoveReviewer}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlossaryDetails;
