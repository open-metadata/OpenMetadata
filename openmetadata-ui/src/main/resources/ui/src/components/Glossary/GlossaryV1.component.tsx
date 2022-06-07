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
import { isEmpty } from 'lodash';
import { GlossaryTermAssets, LoadingState } from 'Models';
import RcTree from 'rc-tree';
import { DataNode, EventDataNode } from 'rc-tree/lib/interface';
import React, { Fragment, useEffect, useRef, useState } from 'react';
import { Tooltip } from 'react-tippy';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { TITLE_FOR_NON_ADMIN_ACTION } from '../../constants/constants';
import { Glossary } from '../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { useAuth } from '../../hooks/authHooks';
import { ModifiedGlossaryData } from '../../pages/GlossaryPage/GlossaryPageV1.component';
import { getEntityDeleteMessage } from '../../utils/CommonUtils';
import { generateTreeData } from '../../utils/GlossaryUtils';
import { getGlossaryPath } from '../../utils/RouterUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { Button } from '../buttons/Button/Button';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import Searchbar from '../common/searchbar/Searchbar';
import TitleBreadcrumb from '../common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';
import TreeView from '../common/TreeView/TreeView.component';
import PageLayout from '../containers/PageLayout';
import GlossaryDetails from '../GlossaryDetails/GlossaryDetails.component';
import GlossaryTermsV1 from '../GlossaryTerms/GlossaryTermsV1.component';
import Loader from '../Loader/Loader';
import EntityDeleteModal from '../Modals/EntityDeleteModal/EntityDeleteModal';

type Props = {
  assetData: GlossaryTermAssets;
  deleteStatus: LoadingState;
  isSearchResultEmpty: boolean;
  isHasAccess: boolean;
  glossaryList: ModifiedGlossaryData[];
  selectedKey: string;
  expandedKey: string[];
  loadingKey: string[];
  handleExpandedKey: (key: string[]) => void;
  handleSelectedKey?: (key: string) => void;
  searchText: string;
  selectedData: Glossary | GlossaryTerm;
  isGlossaryActive: boolean;
  currentPage: number;
  handleAddGlossaryClick: () => void;
  handleAddGlossaryTermClick: () => void;
  updateGlossary: (value: Glossary) => void;
  handleGlossaryTermUpdate: (value: GlossaryTerm) => void;
  handleSelectedData: (key: string) => void;
  handleChildLoading: (status: boolean) => void;
  handleSearchText: (text: string) => void;
  onGlossaryDelete: (id: string) => void;
  onGlossaryTermDelete: (id: string) => void;
  onAssetPaginate: (num: string | number, activePage?: number) => void;
  onRelatedTermClick?: (fqn: string) => void;
  afterDeleteAction?: () => void;
  handleUserRedirection?: (name: string) => void;
  isChildLoading: boolean;
};

const GlossaryV1 = ({
  assetData,
  deleteStatus = 'initial',
  isSearchResultEmpty,
  isHasAccess,
  glossaryList,
  selectedKey,
  expandedKey,
  loadingKey,
  handleExpandedKey,
  handleUserRedirection,
  searchText,
  selectedData,
  isGlossaryActive,
  isChildLoading,
  handleSelectedData,
  afterDeleteAction,
  handleAddGlossaryClick,
  handleAddGlossaryTermClick,
  handleGlossaryTermUpdate,
  updateGlossary,
  handleChildLoading,
  handleSearchText,
  onGlossaryDelete,
  onGlossaryTermDelete,
  onAssetPaginate,
  onRelatedTermClick,
  currentPage,
}: Props) => {
  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();
  const treeRef = useRef<RcTree<DataNode>>(null);
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const [showActions, setShowActions] = useState(false);
  const [isDelete, setIsDelete] = useState<boolean>(false);

  /**
   * To create breadcrumb from the fqn
   * @param fqn fqn of glossary or glossary term
   */
  const handleBreadcrum = (fqn: string) => {
    const arr = fqn.split(FQN_SEPARATOR_CHAR);
    const dataFQN: Array<string> = [];
    const newData = arr.map((d, i) => {
      dataFQN.push(d);
      const isLink = i < arr.length - 1;

      return {
        name: d,
        url: isLink ? getGlossaryPath(dataFQN.join(FQN_SEPARATOR_CHAR)) : '',
        activeTitle: isLink,
      };
    });
    setBreadcrumb(newData);
  };

  const handleDelete = () => {
    const { id } = selectedData;
    if (isGlossaryActive) {
      onGlossaryDelete(id);
    } else {
      onGlossaryTermDelete(id);
    }
    afterDeleteAction?.();
  };

  const handleTreeClick = (
    _event: React.MouseEvent<HTMLElement, MouseEvent>,
    node: EventDataNode
  ) => {
    const key = node.key as string;
    if (selectedKey !== key) {
      handleChildLoading(true);
      handleSelectedData(key);
    }
  };

  useEffect(() => {
    if (glossaryList.length) {
      const generatedData = generateTreeData(glossaryList);
      setTreeData(generatedData);
    }
  }, [glossaryList]);

  useEffect(() => {
    handleBreadcrum(selectedKey);
  }, [selectedKey]);

  const manageButtonContent = () => {
    return (
      <div
        className="tw-flex tw-items-center tw-gap-5 tw-p-1.5 tw-cursor-pointer"
        onClick={() => setIsDelete(true)}>
        <div>
          <SVGIcons
            alt="Delete"
            className="tw-w-12"
            icon={Icons.DELETE_GRADIANT}
          />
        </div>
        <div className="tw-text-left">
          <p className="tw-font-medium">
            Delete Glossary “{selectedData?.displayName || selectedData?.name}”
          </p>
          <p className="tw-text-grey-muted tw-text-xs">
            Deleting this Glossary{' '}
            {(selectedData as GlossaryTerm)?.glossary && 'Term'} will
            permanently remove its metadata from OpenMetadata.
          </p>
        </div>
      </div>
    );
  };

  const fetchLeftPanel = () => {
    return (
      <div className="tw-px-2">
        <div className="tw-bg-white tw-shadow-box tw-border tw-border-border-gray tw-rounded-md tw-min-h-full tw-h-80vh tw-py-2">
          <div className="tw-flex tw-justify-between tw-items-center tw-px-3">
            <h6 className="tw-heading tw-text-base">Glossary</h6>
          </div>
          <div>
            {treeData.length ? (
              <Fragment>
                <div className="tw-px-3 tw-mb-3">
                  <Searchbar
                    showLoadingStatus
                    placeholder="Search term..."
                    searchValue={searchText}
                    typingInterval={500}
                    onSearch={handleSearchText}
                  />
                  <NonAdminAction
                    position="bottom"
                    title={TITLE_FOR_NON_ADMIN_ACTION}>
                    <button
                      className="tw--mt-1 tw-w-full tw-flex-center tw-gap-2 tw-py-1 tw-text-primary tw-border tw-rounded-md"
                      onClick={handleAddGlossaryClick}>
                      <SVGIcons alt="plus" icon={Icons.ICON_PLUS_PRIMERY} />{' '}
                      <span>Add Glossary</span>
                    </button>
                  </NonAdminAction>
                </div>
                {isSearchResultEmpty ? (
                  <p className="tw-text-grey-muted tw-text-center">
                    {searchText ? (
                      <span>{`No Glossary found for "${searchText}"`}</span>
                    ) : (
                      <span>No Glossary found</span>
                    )}
                  </p>
                ) : (
                  <TreeView
                    className="tw-px-2"
                    expandedKeys={expandedKey}
                    handleClick={handleTreeClick}
                    handleExpand={(key) => handleExpandedKey(key as string[])}
                    loadingKey={loadingKey}
                    ref={treeRef}
                    selectedKeys={[selectedKey]}
                    treeData={treeData}
                  />
                )}
              </Fragment>
            ) : (
              <Loader />
            )}
          </div>
        </div>
      </div>
    );
  };

  return glossaryList.length ? (
    <PageLayout classes="tw-h-full tw-px-6" leftPanel={fetchLeftPanel()}>
      <div
        className="tw-flex tw-justify-between tw-items-center"
        data-testid="header">
        <div
          className="tw-heading tw-text-link tw-text-base"
          data-testid="category-name">
          <TitleBreadcrumb titleLinks={breadcrumb} />
        </div>
        <div className="tw-relative tw-mr-2 tw--mt-2">
          <NonAdminAction position="bottom" title={TITLE_FOR_NON_ADMIN_ACTION}>
            <Button
              className={classNames('tw-h-8 tw-rounded tw-mb-1 tw-mr-2', {
                'tw-opacity-40': isHasAccess,
              })}
              data-testid="add-new-tag-button"
              size="small"
              theme="primary"
              variant="contained"
              onClick={handleAddGlossaryTermClick}>
              Add term
            </Button>
          </NonAdminAction>
          <NonAdminAction position="bottom" title={TITLE_FOR_NON_ADMIN_ACTION}>
            <Button
              className="tw-h-8 tw-rounded tw-mb-1 tw-flex"
              data-testid="manage-button"
              disabled={isHasAccess}
              size="small"
              theme="primary"
              variant="outlined"
              onClick={() => setShowActions(true)}>
              <span className="tw-mr-2">Manage</span>
              <Tooltip
                arrow
                arrowSize="big"
                disabled={!isAuthDisabled && !isAdminUser}
                html={manageButtonContent()}
                open={showActions}
                position="bottom-end"
                theme="light"
                onRequestClose={() => setShowActions(false)}>
                <span>
                  <FontAwesomeIcon icon="ellipsis-vertical" />
                </span>
              </Tooltip>
            </Button>
          </NonAdminAction>
        </div>
      </div>
      {isChildLoading ? (
        <Loader />
      ) : (
        !isEmpty(selectedData) &&
        (isGlossaryActive ? (
          <GlossaryDetails
            glossary={selectedData as Glossary}
            handleUserRedirection={handleUserRedirection}
            isHasAccess={isHasAccess}
            updateGlossary={updateGlossary}
          />
        ) : (
          <GlossaryTermsV1
            assetData={assetData}
            currentPage={currentPage}
            glossaryTerm={selectedData as GlossaryTerm}
            handleGlossaryTermUpdate={handleGlossaryTermUpdate}
            handleUserRedirection={handleUserRedirection}
            isHasAccess={isHasAccess}
            onAssetPaginate={onAssetPaginate}
            onRelatedTermClick={onRelatedTermClick}
          />
        ))
      )}
      {selectedData && isDelete && (
        <EntityDeleteModal
          bodyText={getEntityDeleteMessage(selectedData.name, '')}
          entityName={selectedData.name}
          entityType="Glossary"
          loadingState={deleteStatus}
          onCancel={() => setIsDelete(false)}
          onConfirm={handleDelete}
        />
      )}
    </PageLayout>
  ) : (
    <PageLayout>
      <ErrorPlaceHolder>
        <p className="tw-text-center">No glossaries found</p>
        <p className="tw-text-center">
          <NonAdminAction position="bottom" title={TITLE_FOR_NON_ADMIN_ACTION}>
            <Button
              className={classNames('tw-h-8 tw-rounded tw-my-3', {
                'tw-opacity-40': !isAdminUser && !isAuthDisabled,
              })}
              data-testid="add-webhook-button"
              size="small"
              theme="primary"
              variant="contained"
              onClick={handleAddGlossaryClick}>
              Add New Glossary
            </Button>
          </NonAdminAction>
        </p>
      </ErrorPlaceHolder>
    </PageLayout>
  );
};

export default GlossaryV1;
