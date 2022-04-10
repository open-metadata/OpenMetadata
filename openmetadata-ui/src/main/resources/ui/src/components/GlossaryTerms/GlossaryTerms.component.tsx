import classNames from 'classnames';
import { isUndefined } from 'lodash';
import { EntityTags, GlossaryTermAssets } from 'Models';
import RcTree from 'rc-tree';
import { DataNode, EventDataNode } from 'rc-tree/lib/interface';
import React, { Fragment, useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import {
  getAddGlossaryTermsPath,
  getGlossaryTermsPath,
  TITLE_FOR_NON_ADMIN_ACTION,
} from '../../constants/constants';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { LabelType, State } from '../../generated/type/tagLabel';
import { getNameFromFQN } from '../../utils/CommonUtils';
import SVGIcons from '../../utils/SvgUtils';
import { Button } from '../buttons/Button/Button';
import Description from '../common/description/Description';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import SearchInput from '../common/SearchInput/SearchInput.component';
import TabsPane from '../common/TabsPane/TabsPane';
import TitleBreadcrumb from '../common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';
import TreeView from '../common/TreeView/TreeView.component';
import PageLayout from '../containers/PageLayout';
import GlossaryDetails from '../GlossaryDetails/GlossaryDetails.component';
import Loader from '../Loader/Loader';
import TagsContainer from '../tags-container/tags-container';
import Tags from '../tags/tags';
import { GlossaryTermsProps } from './GlossaryTerms.interface';
import AssetsTabs from './tabs/AssetsTabs.component';
import RelationshipTab from './tabs/RelationshipTab.component';

const GlossaryTerms = ({
  allowAccess,
  slashedTableName,
  glossaryTermsDetails,
  glossaryDetails,
  activeGlossaryTerm,
  activeTab,
  selectedKeys,
  expandedKeys,
  queryParams,
  showGlossaryDetails,
  updateReviewer,
  handleSelectedKey,
  handleExpand,
  activeTabHandler,
  handleActiveGlossaryTerm,
  handleGlossaryTermUpdate,
  tagList,
  isTagLoading,
  fetchTags,
}: GlossaryTermsProps) => {
  const treeRef = useRef<RcTree<DataNode>>(null);
  const history = useHistory();
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [formatedData, setFormatedData] =
    useState<{ [key: string]: GlossaryTerm }>();
  const [isLoading, setIsLoading] = useState(true);
  const [breadcrumb, setBreadcrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const [activeFQN, setActiveFQN] = useState('');
  const [searchText, setSearchText] = useState('');
  const [isTagEditable, setIsTagEditable] = useState<boolean>(false);

  const [isDescriptionEditable, setIsDescriptionEditable] = useState(false);

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

  const onDescriptionEdit = (): void => {
    setIsDescriptionEditable(true);
  };
  const onCancel = () => {
    setIsDescriptionEditable(false);
  };

  const handleSearchAction = (searchValue: string) => {
    setSearchText(searchValue);
  };

  const generateTreeData = (data: GlossaryTerm[]): DataNode[] => {
    return data.map((d) => {
      return d.children?.length
        ? {
            key: d?.fullyQualifiedName || d.name,
            title: getNameFromFQN(d.name),
            children: generateTreeData(d.children as unknown as GlossaryTerm[]),
          }
        : {
            key: d?.fullyQualifiedName || d.name,
            title: getNameFromFQN(d.name),
          };
    });
  };

  const updateGlossaryTerm = (key: string) => {
    if (formatedData && !isUndefined(formatedData[key])) {
      handleActiveGlossaryTerm(formatedData[key], key);
    } else {
      handleActiveGlossaryTerm(undefined, key);
    }
  };

  const handleTreeClick = (
    _event: React.MouseEvent<HTMLElement, MouseEvent>,
    node: EventDataNode
  ) => {
    const key = node.key as string;
    const breadCrumbData = treeRef.current?.state.keyEntities[key].nodes || [];
    // const selectedNodeFQN = formatedData
    //   ? formatedData[key]?.fullyQualifiedName || formatedData[key]?.name
    //   : '';
    const nodes = breadCrumbData.map((d) => ({
      name: d.title as string,
      url: '',
      activeTitle: true,
    }));
    handleSelectedKey(key);
    setActiveFQN(key);
    history.push({
      pathname: getGlossaryTermsPath(slashedTableName[0].name, key),
    });

    setBreadcrumb([...slashedTableName, ...nodes]);
    updateGlossaryTerm(key);
  };

  const handleBreadcrum = (arr: Array<string>) => {
    const newData = arr.map((d) => ({
      name: d,
      url: '',
      activeTitle: true,
    }));
    setBreadcrumb([...slashedTableName, ...newData]);
  };

  useEffect(() => {
    if (glossaryTermsDetails.length) {
      setIsLoading(true);
      const filterData = glossaryTermsDetails.filter((d) => !d.parent);
      const treeData = generateTreeData(filterData);
      const glossaryFormatedData = filterData.reduce((acc, curr) => {
        return {
          ...acc,
          [(curr.fullyQualifiedName || curr.name) as string]: curr,
        };
      }, {} as { [key: string]: GlossaryTerm });
      setFormatedData(glossaryFormatedData);
      if (queryParams) {
        const selectedKey = queryParams;
        handleActiveGlossaryTerm(
          glossaryFormatedData[selectedKey],
          selectedKey
        );
        handleBreadcrum(queryParams.split(FQN_SEPARATOR_CHAR).splice(1));
        // if (queryParams.length > 1) {
        //   const expandedKey = [...queryParams];
        //   expandedKey.pop();
        //   handleSelectedKey(selectedKey);
        //   handleExpand(expandedKey);
        // } else {
        //   handleSelectedKey(queryParams[0]);
        // }
        handleSelectedKey(queryParams);
      } else {
        handleBreadcrum(selectedKeys ? [selectedKeys] : []);
      }
      setTreeData(treeData);
    } else {
      handleBreadcrum([]);
    }
    setIsLoading(false);
  }, [glossaryTermsDetails]);

  const handleAddGlossaryTermClick = () => {
    history.push(getAddGlossaryTermsPath(glossaryDetails.name, activeFQN));
  };

  const getSelectedTags = () => {
    return (activeGlossaryTerm?.tags || []).map((tag) => ({
      tagFQN: tag.tagFQN,
      isRemovable: true,
    }));
  };

  const onTagUpdate = (selectedTags?: Array<string>) => {
    if (selectedTags) {
      const prevTags =
        activeGlossaryTerm?.tags?.filter((tag) =>
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
      const updatedGlossaryTerm = {
        ...activeGlossaryTerm,
        tags: updatedTags,
      };
      handleGlossaryTermUpdate(updatedGlossaryTerm as GlossaryTerm);
    }
  };
  const handleTagSelection = (selectedTags?: Array<EntityTags>) => {
    onTagUpdate?.(selectedTags?.map((tag) => tag.tagFQN));
    setIsTagEditable(false);
  };

  const onDescriptionUpdate = (updatedHTML: string) => {
    if (activeGlossaryTerm?.description !== updatedHTML) {
      const updatedTableDetails = {
        ...activeGlossaryTerm,
        description: updatedHTML,
      };
      handleGlossaryTermUpdate(updatedTableDetails as GlossaryTerm);
      setIsDescriptionEditable(false);
    } else {
      setIsDescriptionEditable(false);
    }
  };

  const fetchHeader = () => {
    return (
      <div
        className="tw-flex tw-justify-between tw-items-center"
        data-testid="header">
        <TitleBreadcrumb noLink titleLinks={breadcrumb} />
        <NonAdminAction position="bottom" title={TITLE_FOR_NON_ADMIN_ACTION}>
          <Button
            className={classNames('tw-h-8 tw-rounded', {
              'tw-opacity-40': !allowAccess,
            })}
            data-testid="add-new-user-button"
            size="small"
            theme="primary"
            variant="contained"
            onClick={handleAddGlossaryTermClick}>
            Add term
          </Button>
        </NonAdminAction>
      </div>
    );
  };

  const fetchLeftPanel = () => {
    return (
      <Fragment>
        <div>
          <SearchInput
            placeholder="Find in tree..."
            searchValue={searchText}
            typingInterval={500}
            onSearch={handleSearchAction}
          />
        </div>
        <TreeView
          expandedKeys={expandedKeys}
          handleClick={handleTreeClick}
          handleExpand={handleExpand}
          ref={treeRef}
          selectedKeys={[selectedKeys]}
          treeData={treeData}
        />
      </Fragment>
    );
  };

  return (
    <PageLayout
      classes="tw-h-full tw-px-6"
      header={fetchHeader()}
      leftPanel={fetchLeftPanel()}>
      {isLoading ? (
        <Loader />
      ) : showGlossaryDetails ? (
        <GlossaryDetails
          isHasAccess
          glossary={glossaryDetails}
          updateGlossary={updateReviewer}
        />
      ) : activeGlossaryTerm ? (
        <div className="tw-w-full tw-h-full tw-flex tw-flex-col">
          <div>
            <div className="tw-flex tw-gap-5">
              <div>
                <p className="tw-font-medium tw-mb-2">Glossary</p>
                <p className="tw-font-medium tw-mb-2">Status</p>
              </div>
              <div>
                <p className="tw-text-grey-muted tw-mb-2">
                  {activeGlossaryTerm.glossary.name}
                </p>
                <p className="tw-text-grey-muted tw-mb-2">
                  {activeGlossaryTerm.status}
                </p>
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
                    {activeGlossaryTerm?.tags &&
                    activeGlossaryTerm?.tags.length ? (
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

            <div className="" data-testid="description-container">
              <Description
                blurWithBodyBG
                description={activeGlossaryTerm.description || ''}
                entityName={
                  activeGlossaryTerm?.displayName ?? activeGlossaryTerm?.name
                }
                isEdit={isDescriptionEditable}
                onCancel={onCancel}
                onDescriptionEdit={onDescriptionEdit}
                onDescriptionUpdate={onDescriptionUpdate}
              />
            </div>
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
              {activeTab === 2 && (
                <AssetsTabs
                  assetData={{} as GlossaryTermAssets}
                  currentPage={1}
                  onAssetPaginate={() => {
                    return;
                  }}
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        <div>No Data available</div>
      )}
    </PageLayout>
  );
};

export default GlossaryTerms;
