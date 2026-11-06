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

import {
  Box,
  Select,
  Typography,
  type SelectItemType,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { debounce, get } from 'lodash';
import {
  FC,
  HTMLAttributes,
  Key,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { PAGE_SIZE } from '../../../constants/constants';
import { EntityType, FqnPart } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { EntityReference } from '../../../generated/entity/type';
import { ExploreSearchIndex } from '../../../interface/discovery/explore.interface';
import { searchQuery } from '../../../rest/searchAPI';
import { getLayoutGutter } from '../../../utils/common/layout.utils';
import {
  getEntityName,
  getEntityNameLabel,
} from '../../../utils/EntityNameUtils';
import { getPartialNameFromTableFQN } from '../../../utils/FqnUtils';
import serviceUtilClassBase from '../../../utils/ServiceUtilClassBase';
import { getEntityIcon } from '../../../utils/TableUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { SourceType } from '../../SearchedData/SearchedData.interface';

interface EntitySuggestionProps extends HTMLAttributes<HTMLDivElement> {
  onSelectHandler: (value: EntityReference) => void;
  entityType: string;
  queryFilter?: Record<string, unknown>;
}

const NodeSuggestions: FC<EntitySuggestionProps> = ({
  entityType,
  queryFilter,
  onSelectHandler,
}) => {
  const { t } = useTranslation();
  const [data, setData] = useState<Array<SourceType>>([]);
  const [searchValue, setSearchValue] = useState<string>('');

  const getSuggestionLabelHeading = useCallback((fqn: string, type: string) => {
    if (type === EntityType.TABLE) {
      const database = getPartialNameFromTableFQN(fqn, [FqnPart.Database]);
      const schema = getPartialNameFromTableFQN(fqn, [FqnPart.Schema]);

      return database && schema
        ? `${database}${FQN_SEPARATOR_CHAR}${schema}`
        : '';
    } else {
      return '';
    }
  }, []);

  const getSearchResults = useCallback(
    async (value: string) => {
      try {
        const data = await searchQuery({
          query: value,
          searchIndex: (entityType as ExploreSearchIndex) ?? SearchIndex.TABLE,
          queryFilter,
          pageNumber: 1,
          pageSize: PAGE_SIZE,
          includeDeleted: false,
        });
        const sources = data.hits.hits.map((hit) => hit._source);
        setData(sources);
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.entity-fetch-error', {
            entity: t('label.suggestion-lowercase-plural'),
          })
        );
      }
    },
    [entityType, queryFilter]
  );

  const debounceOnSearch = useCallback(debounce(getSearchResults, 300), [
    getSearchResults,
  ]);

  const entityByFqn = useMemo(
    () => new Map(data.map((entity) => [entity.fullyQualifiedName, entity])),
    [data]
  );

  const nodeSelectOptions = useMemo(
    () =>
      data.map((entity) => ({
        id: entity.fullyQualifiedName ?? '',
        label: getEntityName(entity),
      })),
    [data]
  );

  const handleSelect = useCallback(
    (key: Key | null) => {
      const entity = entityByFqn.get(key as string);
      if (entity) {
        onSelectHandler(entity as EntityReference);
      }
    },
    [entityByFqn, onSelectHandler]
  );

  const renderOption = useCallback(
    (item: SelectItemType) => {
      const entity = entityByFqn.get(item.id);

      return (
        <Select.Item
          data-testid={`node-suggestion-${item.id}`}
          id={item.id}
          key={item.id}
          textValue={item.label}>
          {entity && (
            <Box align="center" className="tw:overflow-hidden" gap={2}>
              <img
                alt={get(entity, 'serviceType', '') || entity.name}
                height="16px"
                src={serviceUtilClassBase.getServiceTypeLogo(entity)}
                width="16px"
              />
              <Box className="tw:min-w-0 tw:flex-1" direction="col">
                {entity.entityType === EntityType.TABLE && (
                  <Typography
                    className="tw:break-all tw:whitespace-normal"
                    color="secondary"
                    size="text-xs">
                    {getSuggestionLabelHeading(item.id, entity.entityType)}
                  </Typography>
                )}
                <Typography ellipsis color="secondary" size="text-xs">
                  {entity.name}
                </Typography>
                <Typography ellipsis size="text-sm" weight="medium">
                  {item.label}
                </Typography>
              </Box>
            </Box>
          )}
        </Select.Item>
      );
    },
    [entityByFqn, getSuggestionLabelHeading]
  );

  const handleChange = useCallback(
    (value: string): void => {
      setSearchValue(value);
      debounceOnSearch(value);
    },
    [debounceOnSearch]
  );

  useEffect(() => {
    getSearchResults(searchValue);
  }, []);

  const entityIcon = useMemo(
    () => getEntityIcon(entityType, 'tw:h-4 tw:w-4'),
    [entityType]
  );

  return (
    <Box
      className="layout-row p-md items-center"
      data-testid="suggestion-node"
      style={{ ...getLayoutGutter(8) }}
      wrap="nowrap">
      <Box className="layout-column tw:block">{entityIcon}</Box>
      <Box className="layout-column tw:block" style={{ flex: '1 1 auto' }}>
        <Select.ComboBox
          allowsCustomValue
          allowsEmptyCollection
          // eslint-disable-next-line jsx-a11y/no-autofocus -- focus required for inline node search
          autoFocus
          aria-label={t('label.search-for-type', {
            type: getEntityNameLabel(entityType),
          })}
          className="tw:w-full"
          data-testid="node-search-box"
          inputValue={searchValue}
          items={nodeSelectOptions}
          placeholder={`${t('label.search-for-type', {
            type: getEntityNameLabel(entityType),
          })}s...`}
          selectedKey={null}
          shortcut={false}
          onInputChange={handleChange}
          onSelectionChange={handleSelect}>
          {renderOption}
        </Select.ComboBox>
      </Box>
    </Box>
  );
};

export default NodeSuggestions;
