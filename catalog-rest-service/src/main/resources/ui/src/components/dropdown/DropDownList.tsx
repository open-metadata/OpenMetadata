import classNames from 'classnames';
import { isNil, lowerCase } from 'lodash';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { DropDownListItem, DropDownListProp } from './types';

const DropDownList: FunctionComponent<DropDownListProp> = ({
  dropDownList,
  listGroups = [],
  horzPosRight,
  searchString = '',
  showSearchBar = false,
  value,
  onSelect,
}: DropDownListProp) => {
  const [searchedList, setSearchedList] = useState(dropDownList);
  const [searchText, setSearchText] = useState(searchString);

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
          'tw-text-gray-700 tw-block tw-px-4 tw-py-2 tw-text-sm hover:tw-bg-gray-200',
          !isNil(value) && item.value === value ? 'tw-bg-primary-light' : null
        )}
        id={`menu-item-${index}`}
        key={index}
        role="menuitem"
        onClick={(e) => onSelect && onSelect(e, item.value)}>
        {item.name}
      </span>
    );
  };

  useEffect(() => {
    setSearchText(searchString);
  }, [searchString]);

  useEffect(() => {
    setSearchedList(
      dropDownList.filter((item) => {
        return lowerCase(item.name).includes(lowerCase(searchText));
      })
    );
  }, [searchText, dropDownList]);

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
              'dropdown-list',
              horzPosRight ? 'dd-horz-right' : 'dd-horz-left'
            )}
            role="menu">
            {showSearchBar && (
              <div className="has-search tw-p-4 tw-pb-2">
                <input
                  className="form-control form-control-sm search"
                  placeholder="Search..."
                  type="text"
                  onChange={(e) => {
                    handleListSearch(e.target.value);
                  }}
                />
              </div>
            )}

            <div className="tw-py-1 tw-max-h-60 tw-overflow-y-auto" role="none">
              {getSearchedListByGroup().map(
                (item: DropDownListItem, index: number) =>
                  getDropDownElement(item, index)
              )}
              {listGroups.map((grp, index) => {
                return (
                  <div key={index}>
                    <span className="tw-flex tw-my-1 tw-text-gray-500">
                      <hr className="tw-mt-2 tw-w-full " />
                      <span className="tw-text-xs tw-px-0.5">{grp}</span>{' '}
                      <hr className="tw-mt-2 tw-w-full" />
                    </span>
                    {getSearchedListByGroup(grp).map(
                      (item: DropDownListItem, index: number) =>
                        getDropDownElement(item, index)
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default DropDownList;
