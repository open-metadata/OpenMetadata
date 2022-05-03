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

import classNames from 'classnames';
import React, { FC, Fragment, HTMLAttributes, useState } from 'react';
import AppState from '../../AppState';
import {
  inPageSearchOptions,
  isInPageSearchAllowed,
} from '../../utils/RouterUtils';
import SVGIcons from '../../utils/SvgUtils';
import SearchOptions from '../app-bar/SearchOptions';
import Suggestions from '../app-bar/Suggestions';

interface AdvanceSearchProp extends HTMLAttributes<HTMLDivElement> {
  searchValue: string;
  isTourRoute?: boolean;
  pathname: string;
  isSearchBoxOpen: boolean;
  handleSearchChange: (value: string) => void;
  handleOnClick: () => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  handleSearchBoxOpen: (value: boolean) => void;
}

export interface Filter {
  key: string;
  value: string;
}

const AdvanceSearch: FC<AdvanceSearchProp> = ({
  searchValue,
  handleOnClick,
  handleSearchChange,
  handleKeyDown,
  handleSearchBoxOpen,
  isSearchBoxOpen,
  isTourRoute,
  pathname,
}) => {
  const [searchIcon, setSearchIcon] = useState<string>('icon-searchv1');
  const [isWrapperFocused, setIsWrapperFocused] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<Array<Filter>>([]);

  const handleOnFocus = () => {
    setSearchIcon('icon-searchv1color');
    setIsWrapperFocused(true);
    handleSearchBoxOpen(true);
  };

  const handleOnBlur = () => {
    setSearchIcon('icon-searchv1');
    setIsWrapperFocused(false);
    handleSearchBoxOpen(false);
  };

  const getAdvanceFilters = () => {
    const filters = [
      'database',
      'column_name',
      'tags',
      'databaseSchema',
      'Services',
    ].filter((f) => !selectedFilters.find((s) => s.key === f));

    return filters;
  };

  const onFilterUpdateHandle = (filter: Filter) => {
    setSelectedFilters((prev) => [...prev, filter]);
  };

  const onFilterRemoveHandle = (filter: Filter) => {
    setSelectedFilters((prev) => prev.filter((f) => f.key !== filter.key));
  };

  return (
    <Fragment>
      <div
        className={classNames(
          'tw-relative search-grey tw-rounded tw-border tw-border-main focus:tw-outline-none tw-form-inputs tw-p-0.5 tw-flex tw-items-center',
          {
            'tw-border-focus': isWrapperFocused,
          }
        )}>
        <div className="tw-w-11/12 tw-flex tw-items-center tw-overflow-x-auto">
          <div className="tw-flex tw-items-center" id="advance-filters">
            {selectedFilters.map((filter, i) => (
              <span
                className={classNames(
                  'tw-border tw-border-primary tw-rounded-2xl tw-inline-block tw-items-center tw-px-1 tw-bg-primary-lite tw-py-0.5 tw-mr-1'
                )}
                key={i}>
                <span className="tw-flex tw-items-center">
                  <span>{filter.key}:</span>
                  <input
                    autoComplete="off"
                    className="tw-border-none focus:tw-outline-none tw-ml-1 tw-w-10/12"
                    name="database"
                    style={{ background: 'none' }}
                    type="text"
                    value={filter.value}
                  />
                  <span
                    className="tw-ml-1 tw-cursor-pointer "
                    onClick={() => onFilterRemoveHandle(filter)}>
                    <SVGIcons
                      alt="times-circle"
                      icon="icon-times-circle"
                      width="20px"
                    />
                  </span>
                </span>
              </span>
            ))}
          </div>
          <div className="tw-w-full">
            <input
              autoComplete="off"
              className="focus:tw-outline-none tw-pl-2 tw-pt-2 tw-pb-1.5 tw-w-full tw-bg-gray-50"
              data-testid="searchBox"
              id="searchBox"
              placeholder="Search for Table, Topics, Dashboards and Pipeline"
              type="text"
              value={searchValue}
              onBlur={handleOnBlur}
              onChange={(e) => {
                handleSearchChange(e.target.value);
              }}
              onFocus={handleOnFocus}
              onKeyDown={handleKeyDown}
            />
          </div>
        </div>
        <div className="tw-w-auto tw-m-auto">
          <span
            className="tw-cursor-pointer tw-block tw-z-40 tw-w-4 tw-h-4 tw-justify-self-end"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleOnClick();
            }}>
            <SVGIcons alt="icon-search" icon={searchIcon} />
          </span>
        </div>
      </div>
      {((!isTourRoute && searchValue) || isSearchBoxOpen) &&
        (isInPageSearchAllowed(pathname) ? (
          <SearchOptions
            isOpen={isSearchBoxOpen}
            options={inPageSearchOptions(pathname)}
            searchText={searchValue}
            selectOption={(text) => {
              AppState.updateInPageSearchText(text);
            }}
            setIsOpen={handleSearchBoxOpen}
          />
        ) : (
          <Suggestions
            filters={getAdvanceFilters()}
            isOpen={isSearchBoxOpen}
            searchText={searchValue}
            setIsOpen={handleSearchBoxOpen}
            onFilterUpdateHandle={onFilterUpdateHandle}
          />
        ))}
    </Fragment>
  );
};

export default AdvanceSearch;
