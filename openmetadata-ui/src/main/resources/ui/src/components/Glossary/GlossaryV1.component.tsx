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
import React, { useEffect, useRef, useState } from 'react';
import { useAuthContext } from '../../auth-provider/AuthProvider';
import { TITLE_FOR_NON_ADMIN_ACTION } from '../../constants/constants';
import { Glossary } from '../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { useAuth } from '../../hooks/authHooks';
import { ModifiedGlossaryData } from '../../pages/GlossaryPage/GlossaryPageV1.component';
import { generateTreeData, getActionsList } from '../../utils/GlossaryUtils';
import { dropdownIcon as DropdownIcon } from '../../utils/svgconstant';
import { Button } from '../buttons/Button/Button';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import SearchInput from '../common/SearchInput/SearchInput.component';
import TitleBreadcrumb from '../common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';
import TreeView from '../common/TreeView/TreeView.component';
import PageLayout from '../containers/PageLayout';
import DropDownList from '../dropdown/DropDownList';
import GlossaryDetails from '../GlossaryDetails/GlossaryDetails.component';
import GlossaryTermsV1 from '../GlossaryTerms/GlossaryTermsV1.component';
import Loader from '../Loader/Loader';
import ConfirmationModal from '../Modals/ConfirmationModal/ConfirmationModal';

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
  handleAddGlossaryClick: () => void;
  handleAddGlossaryTermClick: () => void;
  updateGlossary: (value: Glossary) => void;
  handleGlossaryTermUpdate: (value: GlossaryTerm) => void;
  handleSelectedData: (key: string) => void;
  handleChildLoading: (status: boolean) => void;
  handleSearchText: (text: string) => void;
  onGlossaryDelete: (id: string) => void;
  onGlossaryTermDelete: (id: string) => void;
  onAssetPaginate: (num: number) => void;
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
  searchText,
  selectedData,
  isGlossaryActive,
  isChildLoading,
  handleSelectedData,
  handleAddGlossaryClick,
  handleAddGlossaryTermClick,
  handleGlossaryTermUpdate,
  updateGlossary,
  handleChildLoading,
  handleSearchText,
  onGlossaryDelete,
  onGlossaryTermDelete,
  onAssetPaginate,
}: // handlePathChange,
Props) => {
  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();
  const treeRef = useRef<RcTree<DataNode>>(null);
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const [showActions, setShowActions] = useState(false);
  const [isDelete, setIsDelete] = useState<boolean>(false);

  const handleBreadcrum = (arr: Array<string>) => {
    const newData = arr.map((d) => ({
      name: d,
      url: '',
      activeTitle: true,
    }));
    setBreadcrumb(newData);
  };

  const handleSelectedAction = (
    _e: React.MouseEvent<HTMLElement, MouseEvent>,
    value?: string
  ) => {
    switch (value) {
      case 'add_term': {
        handleAddGlossaryTermClick();

        break;
      }

      case 'delete': {
        setIsDelete(true);

        break;
      }

      default:
        break;
    }
    setShowActions(false);
  };

  const handleDelete = () => {
    const { id } = selectedData;
    if (isGlossaryActive) {
      onGlossaryDelete(id);
    } else {
      onGlossaryTermDelete(id);
    }
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
    handleBreadcrum(selectedKey.split('.'));
  }, [selectedKey]);

  const fetchLeftPanel = () => {
    return (
      <>
        <div className="tw-flex tw-justify-between tw-items-center tw-mb-1">
          <h6 className="tw-heading tw-text-base">Glossary</h6>
          <NonAdminAction position="bottom" title={TITLE_FOR_NON_ADMIN_ACTION}>
            <Button
              className={classNames('tw-h-7 tw-px-2 tw-mb-4', {
                'tw-opacity-40': isHasAccess,
              })}
              data-testid="add-category"
              size="small"
              theme="primary"
              variant="contained"
              onClick={handleAddGlossaryClick}>
              <FontAwesomeIcon icon="plus" />
            </Button>
          </NonAdminAction>
        </div>
        <div>
          {treeData.length ? (
            <>
              <SearchInput
                showLoadingStatus
                placeholder="Search term..."
                searchValue={searchText}
                typingInterval={500}
                onSearch={handleSearchText}
              />
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
                  expandedKeys={expandedKey}
                  handleClick={handleTreeClick}
                  handleExpand={(key) => handleExpandedKey(key as string[])}
                  loadingKey={loadingKey}
                  ref={treeRef}
                  selectedKeys={[selectedKey]}
                  treeData={treeData}
                />
              )}
            </>
          ) : (
            <Loader />
          )}
        </div>
      </>
    );
  };

  return glossaryList.length ? (
    <PageLayout classes="tw-h-full tw-px-6" leftPanel={fetchLeftPanel()}>
      <div
        className="tw-flex tw-justify-between tw-items-center"
        data-testid="header">
        <div
          className="tw-heading tw-text-link tw-text-base tw--mt-2"
          data-testid="category-name">
          <TitleBreadcrumb noLink titleLinks={breadcrumb} />
        </div>
        <div className="tw-relative tw-mr-2">
          <NonAdminAction position="bottom" title={TITLE_FOR_NON_ADMIN_ACTION}>
            <Button
              className={classNames('tw-h-8 tw-rounded tw-mb-1 tw--mt-2', {
                'tw-opacity-40': isHasAccess,
              })}
              data-testid="add-new-tag-button"
              size="small"
              theme="primary"
              variant="contained"
              onClick={() => {
                setShowActions((show) => !show);
              }}>
              Actions{' '}
              {showActions ? (
                <DropdownIcon
                  style={{
                    transform: 'rotate(180deg)',
                    marginTop: '1px',
                    color: '#fff',
                  }}
                />
              ) : (
                <DropdownIcon
                  style={{
                    marginTop: '1px',
                    color: '#fff',
                  }}
                />
              )}
            </Button>
          </NonAdminAction>
          {showActions && (
            <DropDownList
              horzPosRight
              dropDownList={getActionsList()}
              onSelect={handleSelectedAction}
            />
          )}
        </div>
      </div>
      {isChildLoading ? (
        <Loader />
      ) : (
        !isEmpty(selectedData) &&
        (isGlossaryActive ? (
          <GlossaryDetails
            glossary={selectedData as Glossary}
            isHasAccess={isHasAccess}
            updateGlossary={updateGlossary}
          />
        ) : (
          <GlossaryTermsV1
            assetData={assetData}
            glossaryTerm={selectedData as GlossaryTerm}
            handleGlossaryTermUpdate={handleGlossaryTermUpdate}
            isHasAccess={isHasAccess}
            onAssetPaginate={onAssetPaginate}
          />
        ))
      )}
      {selectedData && isDelete && (
        <ConfirmationModal
          bodyText={`You want to delete ${selectedData.name} permanently? This action cannot be reverted.`}
          cancelText="Discard"
          confirmButtonCss="tw-bg-error hover:tw-bg-error focus:tw-bg-error"
          confirmText="Delete"
          header="Are you sure?"
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
