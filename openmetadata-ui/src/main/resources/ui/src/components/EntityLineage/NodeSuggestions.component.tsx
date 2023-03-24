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

import { Empty } from 'antd';
import { AxiosError } from 'axios';
import { PAGE_SIZE } from 'constants/constants';
import { capitalize, debounce } from 'lodash';
import { FormattedTableData } from 'Models';
import React, {
  FC,
  HTMLAttributes,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { getSuggestions, searchData } from 'rest/miscAPI';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { EntityType, FqnPart } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { EntityReference } from '../../generated/type/entityReference';
import { formatDataResponse } from '../../utils/APIUtils';
import { getPartialNameFromTableFQN } from '../../utils/CommonUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { ExploreSearchIndex } from '../Explore/explore.interface';

interface EntitySuggestionProps extends HTMLAttributes<HTMLDivElement> {
  onSelectHandler: (value: EntityReference) => void;
  entityType: string;
}

const NodeSuggestions: FC<EntitySuggestionProps> = ({
  entityType,
  onSelectHandler,
}) => {
  const { t } = useTranslation();

  const [data, setData] = useState<Array<FormattedTableData>>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [searchValue, setSearchValue] = useState<string>('');

  const getSuggestionLabelHeading = (fqn: string, type: string) => {
    if (type === EntityType.TABLE) {
      const database = getPartialNameFromTableFQN(fqn, [FqnPart.Database]);
      const schema = getPartialNameFromTableFQN(fqn, [FqnPart.Schema]);

      return database && schema
        ? `${database}${FQN_SEPARATOR_CHAR}${schema}`
        : '';
    } else {
      return '';
    }
  };

  const getSuggestResults = async (value: string) => {
    try {
      const data = await getSuggestions<ExploreSearchIndex>(
        value,
        SearchIndex[
          entityType as keyof typeof SearchIndex
        ] as ExploreSearchIndex
      );
      setData(
        formatDataResponse(data.data.suggest['metadata-suggest'][0].options)
      );
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.suggestion-lowercase-plural'),
        })
      );
    }
  };

  const getSearchResults = async (value: string) => {
    try {
      const data = await searchData<ExploreSearchIndex>(
        value,
        1,
        PAGE_SIZE,
        '',
        '',
        '',
        SearchIndex[
          entityType as keyof typeof SearchIndex
        ] as ExploreSearchIndex
      );
      setData(formatDataResponse(data.data.hits.hits));
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.suggestion-lowercase-plural'),
        })
      );
    }
  };

  const debouncedOnSearch = useCallback((searchText: string): void => {
    if (searchText) {
      getSuggestResults(searchText);
    } else {
      getSearchResults(searchText);
    }
  }, []);

  const debounceOnSearch = useCallback(debounce(debouncedOnSearch, 300), [
    debouncedOnSearch,
  ]);

  const handleChange = (e: React.ChangeEvent<{ value: string }>): void => {
    const searchText = e.target.value;
    setSearchValue(searchText);
    debounceOnSearch(searchText);
  };

  useEffect(() => {
    setIsOpen(data.length > 0);
  }, [data]);

  useEffect(() => {
    getSearchResults(searchValue);
  }, []);

  return (
    <div data-testid="suggestion-node">
      <input
        className="tw-form-inputs tw-form-inputs-padding tw-w-full"
        data-testid="node-search-box"
        placeholder={`${t('label.search-for-type', {
          type: capitalize(entityType),
        })}s...`}
        type="search"
        value={searchValue}
        onChange={handleChange}
      />
      {data.length > 0 && isOpen ? (
        <div
          aria-labelledby="menu-button"
          aria-orientation="vertical"
          className="suggestion-node-item tw-z-20
           tw-mt-1 tw-rounded-md tw-shadow-lg
        tw-bg-white tw-ring-1 tw-ring-black tw-ring-opacity-5 focus:tw-outline-none text-body"
          role="menu">
          {data.map((entity) => (
            <>
              <div
                className="w-full d-flex items-center tw-px-2 tw-py-2 tw-text-sm hover:tw-bg-body-hover"
                key={entity.fullyQualifiedName}
                onClick={() => {
                  setIsOpen(false);
                  onSelectHandler?.({
                    description: entity.description,
                    displayName: entity.displayName,
                    id: entity.id,
                    type: entity.entityType as string,
                    name: entity.name,
                    fullyQualifiedName: entity.fullyQualifiedName,
                  });
                }}>
                <img
                  alt={entity.serviceType}
                  className="tw-inline tw-h-4 tw-mr-2"
                  src={serviceTypeLogo(entity.serviceType as string)}
                />
                <div className="flex-1 text-left tw-px-2">
                  {entity.entityType === EntityType.TABLE && (
                    <p className="d-block text-xs custom-lineage-heading">
                      {getSuggestionLabelHeading(
                        entity.fullyQualifiedName,
                        entity.entityType as string
                      )}
                    </p>
                  )}
                  <p className="">{entity.name}</p>
                </div>
              </div>
              <hr className="tw-w-full" />
            </>
          ))}
        </div>
      ) : (
        searchValue && (
          <div className="tw-origin-top-right tw-absolute tw-z-20 tw-w-max tw-mt-1 tw-rounded-md tw-shadow-lg tw-bg-white tw-ring-1 tw-ring-black tw-ring-opacity-5 focus:tw-outline-none">
            <Empty
              description={t('label.no-data-found')}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              style={{
                width: '326px',
                height: '70px',
              }}
            />
          </div>
        )
      )}
    </div>
  );
};

export default NodeSuggestions;
