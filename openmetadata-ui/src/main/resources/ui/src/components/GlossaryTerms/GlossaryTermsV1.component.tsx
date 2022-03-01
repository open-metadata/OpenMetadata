import { EntityTags } from 'Models';
import React, { useState } from 'react';
import { TITLE_FOR_NON_ADMIN_ACTION } from '../../constants/constants';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { LabelType, State } from '../../generated/type/tagLabel';
import SVGIcons from '../../utils/SvgUtils';
import { getTagCategories, getTaglist } from '../../utils/TagsUtils';
import Description from '../common/description/Description';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import TabsPane from '../common/TabsPane/TabsPane';
import TagsContainer from '../tags-container/tags-container';
import Tags from '../tags/tags';
import AssetsTabs from './tabs/AssetsTabs.component';
import RelationshipTab from './tabs/RelationshipTab.component';
type Props = {
  glossaryTerm: GlossaryTerm;
  handleGlossaryTermUpdate: (data: GlossaryTerm) => void;
};

const GlossaryTermsV1 = ({ glossaryTerm, handleGlossaryTermUpdate }: Props) => {
  const [isTagEditable, setIsTagEditable] = useState<boolean>(false);
  const [tagList, setTagList] = useState<Array<string>>([]);
  const [isTagLoading, setIsTagLoading] = useState<boolean>(false);
  const [isDescriptionEditable, setIsDescriptionEditable] = useState(false);
  const [activeTab, setActiveTab] = useState(1);

  const tabs = [
    {
      name: 'Relationships',
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
  ];

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

  return (
    <div className="tw-w-full tw-h-full tw-flex tw-flex-col">
      <div className="tw-flex tw-gap-5">
        <div>
          <p className="tw-font-medium tw-mb-2">Glossary</p>
          <p className="tw-font-medium tw-mb-2">Status</p>
        </div>
        <div>
          <p className="tw-text-grey-muted tw-mb-2">
            {glossaryTerm.glossary.name}
          </p>
          <p className="tw-text-grey-muted tw-mb-2">{glossaryTerm.status}</p>
        </div>
      </div>

      <div className="tw-flex tw-flex-wrap tw-group" data-testid="tags">
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
          setActiveTab={activeTabHandler}
          tabs={tabs}
        />

        <div className="tw-bg-white tw-flex-grow tw-py-4">
          {activeTab === 1 && <RelationshipTab />}
          {activeTab === 2 && <AssetsTabs />}
        </div>
      </div>
    </div>
  );
};

export default GlossaryTermsV1;
