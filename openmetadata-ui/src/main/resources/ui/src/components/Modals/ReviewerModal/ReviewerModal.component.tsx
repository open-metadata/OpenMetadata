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

import { AxiosResponse } from 'axios';
import { isUndefined } from 'lodash';
import { FormattedUsersData, SearchResponse } from 'Models';
import React, { useEffect, useState } from 'react';
import { getSuggestions, searchData } from '../../../axiosAPIs/miscAPI';
import { WILD_CARD_CHAR } from '../../../constants/char.constants';
import { SearchIndex } from '../../../enums/search.enum';
import CheckboxUserCard from '../../../pages/teams/CheckboxUserCard';
import { formatUsersResponse } from '../../../utils/APIUtils';
import { Button } from '../../buttons/Button/Button';
import Searchbar from '../../common/searchbar/Searchbar';
import Loader from '../../Loader/Loader';

type ReviewerModalProp = {
  reviewer?: Array<FormattedUsersData>;
  onCancel: () => void;
  onSave: (reviewer: Array<FormattedUsersData>) => void;
  header: string;
};

const ReviewerModal = ({
  reviewer,
  onCancel,
  onSave,
  header,
}: ReviewerModalProp) => {
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [options, setOptions] = useState<FormattedUsersData[]>([]);
  const [selectedOption, setSelectedOption] = useState<FormattedUsersData[]>(
    reviewer ?? []
  );

  const getSearchedReviewers = (searchedData: FormattedUsersData[]) => {
    const currOptions = selectedOption.map((item) => item.name);
    const data = searchedData.filter((item: FormattedUsersData) => {
      return !currOptions.includes(item.name);
    });

    return [...selectedOption, ...data];
  };

  const querySearch = () => {
    setIsLoading(true);
    searchData(WILD_CARD_CHAR, 1, 10, '', '', '', SearchIndex.USER)
      .then((res: SearchResponse) => {
        const data = getSearchedReviewers(
          formatUsersResponse(res.data.hits.hits)
        );
        setOptions(data);
      })
      .catch(() => {
        setOptions([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const suggestionSearch = (searchText = '') => {
    setIsLoading(true);
    getSuggestions(searchText, SearchIndex.USER)
      .then((res: AxiosResponse) => {
        const data = formatUsersResponse(
          res.data.suggest['table-suggest'][0].options
        );
        setOptions(data);
      })
      .catch(() => {
        setOptions(selectedOption);
      })
      .finally(() => setIsLoading(false));
  };

  const handleSearchAction = (text: string) => {
    setSearchText(text);
    if (text) {
      suggestionSearch(text);
    } else {
      querySearch();
    }
  };

  const isIncludeInOptions = (id: string): boolean => {
    return selectedOption.some((d) => d.id === id);
  };

  const selectionHandler = (id: string, isChecked: boolean) => {
    if (!isChecked) {
      setSelectedOption((pre) => pre.filter((option) => option.id !== id));
    } else {
      const newOption: FormattedUsersData =
        options.find((d) => d.id === id) || ({} as FormattedUsersData);
      setSelectedOption([...selectedOption, newOption]);
    }
  };

  const getUserCards = () => {
    return options.map((d) => (
      <CheckboxUserCard
        isActionVisible
        isCheckBoxes
        isIconVisible
        item={{
          name: d.name,
          description: d.displayName,
          id: d.id,
          isChecked: isIncludeInOptions(d.id),
        }}
        key={d.id}
        onSelect={selectionHandler}
      />
    ));
  };

  useEffect(() => {
    if (!isUndefined(reviewer) && reviewer.length) {
      setOptions(reviewer);
    }
    querySearch();
  }, []);

  return (
    <dialog className="tw-modal" data-testid="modal-container">
      <div className="tw-modal-backdrop" onClick={() => onCancel()} />
      <div className="tw-modal-container tw-overflow-y-auto tw-max-w-3xl tw-max-h-screen">
        <div className="tw-modal-header">
          <p className="tw-modal-title tw-text-grey-body" data-testid="header">
            {header}
          </p>
        </div>
        <div className="tw-modal-body">
          <Searchbar
            placeholder="Search for user..."
            searchValue={searchText}
            typingInterval={500}
            onSearch={handleSearchAction}
          />
          <div className="tw-min-h-256">
            {isLoading ? (
              <Loader />
            ) : options.length > 0 ? (
              <div className="tw-grid tw-grid-cols-3 tw-gap-4">
                {getUserCards()}
              </div>
            ) : (
              <p className="tw-text-center tw-mt-10 tw-text-grey-muted tw-text-base">
                No user available
              </p>
            )}
          </div>
        </div>
        <div className="tw-modal-footer" data-testid="cta-container">
          <Button
            size="regular"
            theme="primary"
            variant="link"
            onClick={onCancel}>
            Cancel
          </Button>
          <Button
            data-testid="saveButton"
            size="regular"
            theme="primary"
            type="submit"
            variant="contained"
            onClick={() => onSave(selectedOption)}>
            Save
          </Button>
        </div>
      </div>
    </dialog>
  );
};

export default ReviewerModal;
