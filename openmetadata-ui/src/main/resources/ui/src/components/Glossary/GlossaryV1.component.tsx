import classNames from 'classnames';
import RcTree from 'rc-tree';
import { DataNode, EventDataNode } from 'rc-tree/lib/interface';
import React, { useEffect, useRef, useState } from 'react';
import { TITLE_FOR_NON_ADMIN_ACTION } from '../../constants/constants';
import { Glossary } from '../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { ModifiedGlossaryData } from '../../pages/GlossaryPage/GlossaryPageV1.component';
import { getNameFromFQN } from '../../utils/CommonUtils';
import { Button } from '../buttons/Button/Button';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import SearchInput from '../common/SearchInput/SearchInput.component';
import TitleBreadcrumb from '../common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';
import TreeView from '../common/TreeView/TreeView.component';
import PageLayout from '../containers/PageLayout';
import GlossaryDetails from '../GlossaryDetails/GlossaryDetails.component';
import GlossaryTermsV1 from '../GlossaryTerms/GlossaryTermsV1.component';

type Props = {
  glossaryList: ModifiedGlossaryData[];
  selectedKey: string;
  extendedKey: string[];
  handleExtendedKey: (key: string[]) => void;
  handleSelectedKey: (key: string) => void;
  selectedData: Glossary | GlossaryTerm;
  isGlossaryActive: boolean;
  handleAddGlossaryClick: () => void;
  handleAddGlossaryTermClick: () => void;
  updateGlossary: (value: Glossary) => void;
  handleGlossaryTermUpdate: (value: GlossaryTerm) => void;
  handleSelectedData: (data: Glossary | GlossaryTerm, pos: string) => void;
  // handlePathChange: (
  //   glossary: string,
  //   glossaryTermsFQN?: string | undefined
  // ) => void;
};

type ModifiedDataNode = DataNode & {
  data: Glossary | GlossaryTerm;
};

const GlossaryV1 = ({
  glossaryList,
  selectedKey,
  extendedKey,
  handleExtendedKey,
  handleSelectedKey,
  selectedData,
  isGlossaryActive,
  handleSelectedData,
  handleAddGlossaryClick,
  handleAddGlossaryTermClick,
  handleGlossaryTermUpdate,
  updateGlossary,
}: // handlePathChange,
Props) => {
  const treeRef = useRef<RcTree<DataNode>>(null);
  const [searchText, setSearchText] = useState('');
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);

  const generateTreeData = (data: ModifiedGlossaryData[]): DataNode[] => {
    return data.map((d) => {
      return d.children?.length
        ? {
            key: (d as GlossaryTerm)?.fullyQualifiedName || d.name,
            title: getNameFromFQN(d.name),
            children: generateTreeData(d.children as ModifiedGlossaryData[]),
            data: d,
          }
        : {
            key: (d as GlossaryTerm)?.fullyQualifiedName || d.name,
            title: getNameFromFQN(d.name),
            data: d,
          };
    });
  };

  const handleBreadcrum = (arr: Array<string>) => {
    const newData = arr.map((d) => ({
      name: d,
      url: '',
      activeTitle: true,
    }));
    setBreadcrumb(newData);
  };

  const handleTreeClick = (
    _event: React.MouseEvent<HTMLElement, MouseEvent>,
    node: EventDataNode
  ) => {
    const key = node.key as string;
    const breadCrumbData = (treeRef.current?.state.keyEntities[key].nodes ||
      []) as ModifiedDataNode[];
    handleBreadcrum(breadCrumbData.map((d) => getNameFromFQN(d.key as string)));
    const pos = treeRef.current?.state.keyEntities[key].pos;
    handleSelectedData(
      breadCrumbData[breadCrumbData.length - 1].data,
      pos as string
    );
    // handlePathChange(key.split('.')[0], key);
    handleSelectedKey(key);
  };

  const handleSearchAction = (text: string) => {
    setSearchText(text);
  };

  useEffect(() => {
    if (glossaryList.length) {
      const generatedData = generateTreeData(glossaryList);
      setTreeData(generatedData);
    }
  }, [glossaryList]);

  useEffect(() => {
    handleBreadcrum([selectedKey]);
  }, []);

  const fetchLeftPanel = () => {
    return (
      <>
        <div className="tw-flex tw-justify-between tw-items-center tw-mb-1">
          <h6 className="tw-heading tw-text-base">Glossary</h6>
          <NonAdminAction position="bottom" title={TITLE_FOR_NON_ADMIN_ACTION}>
            <Button
              className={classNames('tw-h-7 tw-px-2 tw-mb-4', {
                // 'tw-opacity-40': !isAdminUser && !isAuthDisabled,
              })}
              data-testid="add-category"
              size="small"
              theme="primary"
              variant="contained"
              onClick={handleAddGlossaryClick}>
              <i aria-hidden="true" className="fa fa-plus" />
            </Button>
          </NonAdminAction>
        </div>
        <div>
          <SearchInput
            placeholder="Search term..."
            searchValue={searchText}
            typingInterval={500}
            onSearch={handleSearchAction}
          />

          <TreeView
            expandedKeys={extendedKey}
            handleClick={handleTreeClick}
            handleExpand={(key) => handleExtendedKey(key as string[])}
            ref={treeRef}
            selectedKeys={[selectedKey]}
            treeData={treeData}
          />
        </div>
      </>
    );
  };

  return (
    <PageLayout classes="tw-h-full tw-px-6" leftPanel={fetchLeftPanel()}>
      <div
        className="tw-flex tw-justify-between tw-items-center"
        data-testid="header">
        <div
          className="tw-heading tw-text-link tw-text-base"
          data-testid="category-name">
          <TitleBreadcrumb noLink titleLinks={breadcrumb} />
        </div>
        <NonAdminAction position="bottom" title={TITLE_FOR_NON_ADMIN_ACTION}>
          <Button
            className={classNames('tw-h-8 tw-rounded tw-mb-3', {
              //   'tw-opacity-40': !isAdminUser && !isAuthDisabled,
            })}
            data-testid="add-new-tag-button"
            size="small"
            theme="primary"
            variant="contained"
            onClick={handleAddGlossaryTermClick}>
            Add new term
          </Button>
        </NonAdminAction>
      </div>
      {selectedData &&
        (isGlossaryActive ? (
          <GlossaryDetails
            glossary={selectedData as Glossary}
            updateGlossary={updateGlossary}
          />
        ) : (
          <GlossaryTermsV1
            glossaryTerm={selectedData as GlossaryTerm}
            handleGlossaryTermUpdate={handleGlossaryTermUpdate}
          />
        ))}
    </PageLayout>
  );
};

export default GlossaryV1;
