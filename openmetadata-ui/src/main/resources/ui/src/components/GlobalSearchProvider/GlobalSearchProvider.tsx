/*
 *  Copyright 2022 Collate.
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

import { Modal } from 'antd';
import { debounce } from 'lodash';
import Qs from 'qs';
import { BaseSelectRef } from 'rc-select';
import React, { FC, ReactNode, useCallback, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { getExplorePath, ROUTES } from '../../constants/constants';
import { addToRecentSearched } from '../../utils/CommonUtils';
import { Keys } from '../../utils/KeyboardUtil';
import GlobalSearchSuggestions from './GlobalSearchSuggestions/GlobalSearchSuggestions';

export const GlobalSearchContext = React.createContext(null);

interface Props {
  children: ReactNode;
}

const GlobalSearchProvider: FC<Props> = ({ children }: Props) => {
  const history = useHistory();
  const selectRef = useRef<BaseSelectRef>(null);
  const [visible, setVisible] = useState<boolean>(false);
  const [searchValue, setSearchValue] = useState<string>();
  const [suggestionSearch, setSuggestionSearch] = useState<string>('');
  const [isSuggestionsLoading, setIsSuggestionsLoading] =
    useState<boolean>(false);

  const handleCancel = () => {
    setSearchValue('');
    setSuggestionSearch('');
    setVisible(false);
  };

  const debouncedOnChange = useCallback(
    (text: string): void => {
      setSuggestionSearch(text);
    },
    [setSuggestionSearch]
  );

  const debounceOnSearch = useCallback(debounce(debouncedOnChange, 400), [
    debouncedOnChange,
  ]);

  const handleIsSuggestionsLoading = (value: boolean) => {
    setIsSuggestionsLoading(value);
  };

  const searchHandler = (value: string) => {
    addToRecentSearched(value);
    if (location.pathname.startsWith(ROUTES.EXPLORE)) {
      // Already on explore page, only push search change
      const paramsObject: Record<string, unknown> = Qs.parse(
        location.search.startsWith('?')
          ? location.search.substr(1)
          : location.search
      );
      history.push({
        search: Qs.stringify({ ...paramsObject, search: value }),
      });
    } else {
      // Outside Explore page
      history.push(getExplorePath({ search: value }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    if (e.key === 'Enter') {
      handleCancel();
      searchHandler(target.value);
    } else if (e.key === Keys.ESC) {
      handleCancel();
    }
  };

  return (
    <GlobalSearchContext.Provider value={null}>
      {children}
      <Modal
        closable
        destroyOnClose
        maskClosable
        bodyStyle={{
          padding: '20px',
          height: searchValue ? '314px' : '85px',
        }}
        closeIcon={<></>}
        footer={null}
        open={visible}
        transitionName=""
        width={650}
        onCancel={handleCancel}>
        <GlobalSearchSuggestions
          handleIsSuggestionsLoading={handleIsSuggestionsLoading}
          isSuggestionsLoading={isSuggestionsLoading}
          searchText={suggestionSearch}
          selectRef={selectRef}
          value={searchValue || ''}
          onInputKeyDown={handleKeyDown}
          onOptionSelection={handleCancel}
          onSearch={(newValue) => {
            debounceOnSearch(newValue);
            setSearchValue(newValue);
            setIsSuggestionsLoading(true);
          }}
        />
      </Modal>
    </GlobalSearchContext.Provider>
  );
};

export default GlobalSearchProvider;
