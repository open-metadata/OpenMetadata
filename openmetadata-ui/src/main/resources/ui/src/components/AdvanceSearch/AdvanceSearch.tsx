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
import React, { FC, Fragment, useEffect, useState } from 'react';
import AppState from '../../AppState';
import {
  inPageSearchOptions,
  isInPageSearchAllowed,
} from '../../utils/RouterUtils';
import SVGIcons from '../../utils/SvgUtils';
import SearchOptions from '../app-bar/SearchOptions';
import Suggestions from '../app-bar/Suggestions';
import { AdvanceSearchProp, Filter } from './AdvanceSearch.interface';
import InputSearch from './InputSearch';
import InputText from './InputText';

const AdvanceSearch: FC<AdvanceSearchProp> = ({
  searchValue,
  handleOnClick,
  handleSearchChange,
  handleKeyDown,
  handleSearchBoxOpen,
  isSearchBoxOpen,
  isTourRoute,
  pathname,
  onFilterChange,
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
    ];

    return filters;
  };

  const onFilterUpdateHandle = (filter: Filter) => {
    setSelectedFilters((prev) => [...prev, filter]);
  };

  const onFilterRemoveHandle = (index: number) => {
    setSelectedFilters((prev) => {
      const selectedValues = [...prev];
      selectedValues.splice(index, 1);

      return selectedValues;
    });
  };

  useEffect(() => {
    onFilterChange(selectedFilters);
  }, [selectedFilters]);

  return (
    <Fragment>
      <div
        className={classNames(
          'tw-relative search-grey tw-rounded tw-border tw-border-main focus:tw-outline-none tw-form-inputs tw-py-0.5 tw-px-1.5 tw-flex tw-items-center',
          {
            'tw-border-focus': isWrapperFocused,
          }
        )}>
        <div
          className="tw-w-11/12 tw-flex tw-items-center tw-overflow-x-auto"
          id="advance-filters">
          <div className="tw-flex tw-items-center">
            {selectedFilters.map((filter, i) => (
              <InputText
                filter={filter}
                index={i}
                key={i}
                onFilterRemoveHandle={onFilterRemoveHandle}
              />
            ))}
          </div>
          <div className="tw-w-full">
            <InputSearch
              handleKeyDown={handleKeyDown}
              handleOnBlur={handleOnBlur}
              handleOnFocus={handleOnFocus}
              handleSearchChange={handleSearchChange}
              placeholder={
                selectedFilters.length
                  ? ''
                  : 'Search for Table, Topics, Dashboards and Pipeline'
              }
              searchValue={searchValue}
            />
          </div>
        </div>
        <div className="tw-w-auto tw-m-auto tw-mt-2">
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
