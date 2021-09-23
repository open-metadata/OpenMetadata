/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import classNames from 'classnames';
import { isNil, lowerCase } from 'lodash';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { getCountBadge } from '../../utils/CommonUtils';
import { DropDownListItem, DropDownListProp } from './types';

const DropDownList: FunctionComponent<DropDownListProp> = ({
  dropDownList,
  listGroups = [],
  horzPosRight,
  searchString = '',
  showSearchBar = false,
  value,
  onSelect,
  groupType = 'label',
}: DropDownListProp) => {
  const [searchedList, setSearchedList] = useState(dropDownList);
  const [searchText, setSearchText] = useState(searchString);
  const [activeTab, setActiveTab] = useState<number>(1);

  const getTabClasses = (tab: number, activeTab: number) => {
    return 'tw-gh-tabs' + (activeTab === tab ? ' active' : '');
  };

  const handleListSearch = (text: string) => {
    setSearchText(text || '');
  };

  const getSearchedListByGroup = (
    groupName?: string
  ): Array<DropDownListItem> => {
    return searchedList.filter((item) => {
      return groupName ? item.group === groupName : !item.group;
    });
  };

  const getDropDownElement = (item: DropDownListItem, index: number) => {
    return (
      <span
        aria-disabled={item.disabled as boolean}
        className={classNames(
          'tw-text-gray-700 tw-block tw-px-4 tw-py-2 tw-text-sm hover:tw-bg-body-hover tw-cursor-pointer',
          !isNil(value) && item.value === value ? 'tw-bg-primary-lite' : null
        )}
        data-testid="list-item"
        id={`menu-item-${index}`}
        key={index}
        role="menuitem"
        onClick={(e) => onSelect && onSelect(e, item.value)}>
        {item.name}
      </span>
    );
  };

  const getActiveTab = () => {
    let tab = 0;
    listGroups.forEach((grp, i) => {
      if (getSearchedListByGroup(grp).length === 0) {
        tab = i + 1;
      }
    });

    return tab;
  };

  useEffect(() => {
    setSearchText(searchString);
  }, [searchString]);

  useEffect(() => {
    setSearchedList(
      dropDownList.filter((item) => {
        return lowerCase(item.name as string).includes(lowerCase(searchText));
      })
    );
  }, [searchText, dropDownList]);

  useEffect(() => {
    setActiveTab(getActiveTab() + 1);
  }, [searchText]);

  return (
    <>
      {searchedList.length > 0 && (
        <>
          <button
            className="tw-z-10 tw-fixed tw-inset-0 tw-h-full tw-w-full tw-bg-black tw-opacity-0"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onSelect && onSelect(e);
            }}
          />
          <div
            aria-labelledby="menu-button"
            aria-orientation="vertical"
            className={classNames(
              'dropdown-list tw-mt-0.5',
              horzPosRight ? 'dd-horz-right' : 'dd-horz-left'
            )}
            data-testid="dropdown-list"
            role="menu">
            {showSearchBar && (
              <div className="has-search tw-p-4 tw-pb-2">
                <input
                  className="tw-form-inputs tw-px-3 tw-py-1"
                  placeholder="Search..."
                  type="text"
                  onChange={(e) => {
                    handleListSearch(e.target.value);
                  }}
                />
              </div>
            )}

            {groupType === 'tab' && (
              <div className="tw-flex tw-justify-around tw-border-b tw-border-separator tw-mb-1">
                {listGroups.map((grp, index) => {
                  return (
                    <button
                      className={getTabClasses(index + 1, activeTab)}
                      data-testid="tab"
                      key={index}
                      onClick={() => setActiveTab(index + 1)}>
                      {grp}
                      {getCountBadge(getSearchedListByGroup(grp).length)}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="tw-py-1 tw-max-h-60 tw-overflow-y-auto" role="none">
              {getSearchedListByGroup().map(
                (item: DropDownListItem, index: number) =>
                  getDropDownElement(item, index)
              )}
              {groupType === 'label' ? (
                listGroups.map((grp, index) => {
                  return (
                    <div key={index}>
                      {getSearchedListByGroup(grp).length > 0 && (
                        <span className="tw-flex tw-my-1 tw-text-grey-muted">
                          <hr className="tw-mt-2 tw-w-full " />
                          <span className="tw-text-xs tw-px-0.5">
                            {grp}
                          </span>{' '}
                          <hr className="tw-mt-2 tw-w-full" />
                        </span>
                      )}
                      {getSearchedListByGroup(grp).map(
                        (item: DropDownListItem, index: number) =>
                          getDropDownElement(item, index)
                      )}
                    </div>
                  );
                })
              ) : (
                <>
                  {getSearchedListByGroup(listGroups[activeTab - 1]).map(
                    (item: DropDownListItem, index: number) =>
                      getDropDownElement(item, index)
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default DropDownList;
