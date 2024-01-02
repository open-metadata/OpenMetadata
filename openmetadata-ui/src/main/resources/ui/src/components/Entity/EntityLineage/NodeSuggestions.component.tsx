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

import { Select } from 'antd';
import { AxiosError } from 'axios';
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
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { PAGE_SIZE } from '../../../constants/constants';
import { EntityType, FqnPart } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/entity/type';
import { SearchSourceAlias } from '../../../interface/search.interface';
import { searchData } from '../../../rest/miscAPI';
import { formatDataResponse } from '../../../utils/APIUtils';
import { getPartialNameFromTableFQN } from '../../../utils/CommonUtils';
import {
  getEntityNodeIcon,
  getSearchIndexFromNodeType,
} from '../../../utils/EntityLineageUtils';
import serviceUtilClassBase from '../../../utils/ServiceUtilClassBase';
import { showErrorToast } from '../../../utils/ToastUtils';
import { ExploreSearchIndex } from '../../Explore/ExplorePage.interface';
import './node-suggestion.less';

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

  const getSearchResults = async (value: string) => {
    try {
      const data = await searchData<ExploreSearchIndex>(
        value,
        1,
        PAGE_SIZE,
        '',
        '',
        '',
        getSearchIndexFromNodeType(entityType)
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
    getSearchResults(searchText);
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
    getSearchResults(searchValue);
  }, []);

  const Icon = getEntityNodeIcon(entityType);

  return (
    <div className="p-x-xs items-center d-flex" data-testid="suggestion-node">
      <Icon className="m-r-xs" height={16} name="entity-icon" width={16} />
      <Select
        autoFocus
        open
        showSearch
        className="w-72 lineage-node-searchbox"
        data-testid="node-search-box"
        options={(data || []).map((entity) => ({
          value: entity.fullyQualifiedName,
          label: (
            <>
              <div
                className="d-flex items-center text-sm"
                key={entity.fullyQualifiedName}
                onClick={() => {
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
                  className="m-r-xs"
                  height="16px"
                  src={serviceUtilClassBase.getServiceTypeLogo(
                    entity as SearchSourceAlias
                  )}
                  width="16px"
                />
                <div className="flex-1 text-left">
                  {entity.entityType === EntityType.TABLE && (
                    <p className="d-block text-xs text-grey-muted w-max-400 truncate">
                      {getSuggestionLabelHeading(
                        entity.fullyQualifiedName,
                        entity.entityType as string
                      )}
                    </p>
                  )}
                  <p className="w-max-400 truncate">{entity.name}</p>
                </div>
              </div>
            </>
          ),
        }))}
        placeholder={`${t('label.search-for-type', {
          type: capitalize(entityType),
        })}s...`}
        onChange={handleChange}
        onClick={(e) => e.stopPropagation()}
        onSearch={debouncedOnSearch}
      />
    </div>
  );
};

export default NodeSuggestions;
