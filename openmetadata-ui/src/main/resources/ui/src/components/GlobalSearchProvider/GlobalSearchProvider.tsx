/*
 *  Copyright 2022 Collate
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
import { BaseSelectRef } from 'rc-select';
import React, {
  FC,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useHistory } from 'react-router-dom';
import AppState from '../../AppState';
import { getExplorePathWithSearch, ROUTES } from '../../constants/constants';
import { addToRecentSearched } from '../../utils/CommonUtils';
import { isCommandKeyPress, Keys } from '../../utils/KeyboardUtil';
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

  const handleCancel = () => {
    setSearchValue('');
    setSuggestionSearch('');
    setVisible(false);
  };

  const handleKeyPress = useCallback((event) => {
    if (isCommandKeyPress(event) && event.key === Keys.K) {
      setVisible(true);
      selectRef.current?.focus();
    } else if (event.key === Keys.ESC) {
      handleCancel();
    }
  }, []);

  const debouncedOnChange = useCallback(
    (text: string): void => {
      setSuggestionSearch(text);
    },
    [setSuggestionSearch]
  );

  const debounceOnSearch = useCallback(debounce(debouncedOnChange, 400), [
    debouncedOnChange,
  ]);

  const searchHandler = (value: string) => {
    addToRecentSearched(value);
    history.push({
      pathname: getExplorePathWithSearch(
        value,
        location.pathname.startsWith(ROUTES.EXPLORE)
          ? AppState.explorePageTab
          : 'tables'
      ),
      search: location.search,
    });
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

  useEffect(() => {
    const targetNode = document.body;
    targetNode.addEventListener('keydown', handleKeyPress);

    return () => targetNode.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  return (
    <GlobalSearchContext.Provider value={null}>
      {children}
      <Modal
        closable
        destroyOnClose
        maskClosable
        bodyStyle={{
          padding: '20px',
          height: '314px',
        }}
        closeIcon={<></>}
        footer={null}
        transitionName=""
        visible={visible}
        width={650}
        onCancel={handleCancel}>
        <GlobalSearchSuggestions
          searchText={suggestionSearch}
          selectRef={selectRef}
          value={searchValue || ''}
          onInputKeyDown={handleKeyDown}
          onOptionSelection={handleCancel}
          onSearch={(newValue) => {
            debounceOnSearch(newValue);
            setSearchValue(newValue);
          }}
        />
      </Modal>
    </GlobalSearchContext.Provider>
  );
};

export default GlobalSearchProvider;
