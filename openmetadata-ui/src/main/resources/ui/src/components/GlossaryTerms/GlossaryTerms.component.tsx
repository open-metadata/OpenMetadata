import classNames from 'classnames';
import { isUndefined } from 'lodash';
import RcTree from 'rc-tree';
import { DataNode, EventDataNode } from 'rc-tree/lib/interface';
import React, { Fragment, useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  getGlossaryTermsPath,
  LIST_SIZE,
  TITLE_FOR_NON_ADMIN_ACTION,
} from '../../constants/constants';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import SVGIcons from '../../utils/SvgUtils';
import { Button } from '../buttons/Button/Button';
import Description from '../common/description/Description';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import PopOver from '../common/popover/PopOver';
import SearchInput from '../common/SearchInput/SearchInput.component';
import TabsPane from '../common/TabsPane/TabsPane';
import TitleBreadcrumb from '../common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';
import TreeView from '../common/TreeView/TreeView.component';
import PageLayout from '../containers/PageLayout';
import GlossaryDetails from '../GlossaryDetails/GlossaryDetails.component';
import Loader from '../Loader/Loader';
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
  updateGlossaryDescription,
  handleSelectedKey,
  handleExpand,
  activeTabHandler,
  handleActiveGlossaryTerm,
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
  const [searchText, setSearchText] = useState('');

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

  const handleSearchAction = (searchValue: string) => {
    setSearchText(searchValue);
  };

  const generateTreeData = (data: GlossaryTerm[]): DataNode[] => {
    return data.map((d) => {
      return d.children?.length
        ? {
            key: d.name,
            title: d.name,
            children: generateTreeData(d.children as unknown as GlossaryTerm[]),
          }
        : {
            key: d.name,
            title: d.name,
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
    const selectedNodeFQN = formatedData
      ? formatedData[key].fullyQualifiedName
      : '';
    const nodes = breadCrumbData.map((d) => ({
      name: d.title as string,
      url: '',
      activeTitle: true,
    }));
    handleSelectedKey(key);

    history.push({
      pathname: getGlossaryTermsPath(slashedTableName[0].name, selectedNodeFQN),
      // search: `terms=${nodes.map((d) => d.name).join(',')}`,
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
      const treeData = generateTreeData(glossaryTermsDetails);
      const glossaryFormatedData = glossaryTermsDetails.reduce((acc, curr) => {
        return {
          ...acc,
          [curr.name as string]: curr,
        };
      }, {} as { [key: string]: GlossaryTerm });
      setFormatedData(glossaryFormatedData);
      if (queryParams.length) {
        const selectedKey = queryParams[queryParams.length - 1];
        handleActiveGlossaryTerm(
          glossaryFormatedData[selectedKey],
          selectedKey
        );
        handleBreadcrum(queryParams ? queryParams : []);
        if (queryParams.length > 1) {
          const expandedKey = [...queryParams];
          expandedKey.pop();
          handleSelectedKey(selectedKey);
          handleExpand(expandedKey);
        } else {
          handleSelectedKey(queryParams[0]);
        }
      } else {
        handleBreadcrum(selectedKeys ? [selectedKeys] : []);
      }
      setTreeData(treeData);
    } else {
      handleBreadcrum([]);
    }
    setIsLoading(false);
  }, [glossaryTermsDetails]);

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
            // onClick={() => setIsAddingUsers(true)}
          >
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
          glossary={glossaryDetails}
          updateGlossaryDescription={updateGlossaryDescription}
          updateReviewer={updateReviewer}
        />
      ) : activeGlossaryTerm ? (
        <div className="tw-w-full tw-h-full tw-flex tw-flex-col">
          <div>
            <div className="tw-flex tw-gap-5 tw-my-2">
              <div>
                <p className="tw-font-medium">Glossary</p>
                <p className="tw-font-medium">Status</p>
              </div>
              <div>
                <p className="tw-text-grey-muted">
                  {activeGlossaryTerm.glossary.name}
                </p>
                <p className="tw-text-grey-muted">
                  {activeGlossaryTerm.status}
                </p>
              </div>
            </div>

            <div className="tw-flex tw-flex-wrap tw-pt-1 tw-group">
              {activeGlossaryTerm.tags &&
                activeGlossaryTerm.tags.length > 0 && (
                  <SVGIcons
                    alt="icon-tag"
                    className="tw-mx-1"
                    icon="icon-tag-grey"
                    width="16"
                  />
                )}
              {/* {tier?.tagFQN && (
              <Tags
                startWith="#"
                tag={{ ...tier, tagFQN: tier.tagFQN.split('.')[1] }}
                type="label"
              />
            )} */}
              {activeGlossaryTerm.tags && activeGlossaryTerm.tags.length > 0 && (
                <div>
                  {activeGlossaryTerm.tags
                    .slice(0, LIST_SIZE)
                    .map((tag, index) => (
                      <Tags
                        className={
                          classNames()
                          // { 'diff-added tw-mx-1': tag?.added },
                          // { 'diff-removed': tag?.removed }
                        }
                        key={index}
                        startWith="#"
                        tag={tag}
                        type="label"
                      />
                    ))}

                  {activeGlossaryTerm.tags.slice(LIST_SIZE).length > 0 && (
                    <PopOver
                      html={
                        <>
                          {activeGlossaryTerm.tags
                            .slice(LIST_SIZE)
                            .map((tag, index) => (
                              <p className="tw-text-left" key={index}>
                                <Tags
                                  className={
                                    classNames()
                                    // { 'diff-added tw-mx-1': tag?.added },
                                    // { 'diff-removed': tag?.removed }
                                  }
                                  startWith="#"
                                  tag={tag}
                                  type="label"
                                />
                              </p>
                            ))}
                        </>
                      }
                      position="right"
                      theme="light"
                      trigger="click">
                      <span className="tw-cursor-pointer tw-text-xs link-text v-align-sub tw--ml-1">
                        •••
                      </span>
                    </PopOver>
                  )}
                </div>
              )}
            </div>

            <div className="tw-my-2" data-testid="description-container">
              <Description
                blurWithBodyBG
                isReadOnly
                description={activeGlossaryTerm.description || ''}
              />
            </div>
          </div>

          <div className="tw-mt-4 tw-flex tw-flex-col tw-flex-grow">
            <TabsPane
              activeTab={activeTab}
              className="tw-flex-initial"
              setActiveTab={activeTabHandler}
              tabs={tabs}
            />

            <div className="tw-bg-white tw-flex-grow tw--mx-6 tw-px-7 tw-py-4">
              {activeTab === 1 && <RelationshipTab />}
              {activeTab === 2 && <AssetsTabs />}
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
