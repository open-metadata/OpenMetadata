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

import { Button, Select } from 'antd';
import { BaseSelectRef } from 'rc-select';
import { AxiosError } from 'axios';
import { capitalize, debounce, get } from 'lodash';
import {
  FC,
  HTMLAttributes,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { PAGE_SIZE } from '../../../constants/constants';
import { entityData } from '../../../constants/Lineage.constants';
import { EntityType, FqnPart } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { EntityReference } from '../../../generated/entity/type';
import { searchQuery } from '../../../rest/searchAPI';
import { getPartialNameFromTableFQN } from '../../../utils/CommonUtils';
import { getEntityNodeIcon } from '../../../utils/EntityLineageUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import serviceUtilClassBase from '../../../utils/ServiceUtilClassBase';
import { showErrorToast } from '../../../utils/ToastUtils';
import { ExploreSearchIndex } from '../../Explore/ExplorePage.interface';
import { SourceType } from '../../SearchedData/SearchedData.interface';
import './node-suggestion.less';
import { Box, Stack, Typography } from '@mui/material';

interface EntitySuggestionProps extends HTMLAttributes<HTMLDivElement> {
  onSelectHandler: (value: EntityReference) => void;
  queryFilter?: Record<string, unknown>;
}

const NodeSuggestionsAddStream: FC<EntitySuggestionProps> = ({
  queryFilter,
  onSelectHandler,
}) => {
  const { t } = useTranslation();
  const selectRef = useRef<BaseSelectRef>(null);

  const [data, setData] = useState<Array<SourceType>>([]);
  const [searchValue, setSearchValue] = useState<string>('');
  const [isOpen, setIsOpen] = useState(true);
  const [isEntityTypeSelectOpen, setIsEntityTypeSelectOpen] = useState(false);
  const [selectedEntityType, setSelectedEntityType] = useState<string>('');

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
      if (!selectedEntityType) {
        return;
      }
      try {
        const data = await searchQuery({
          query: value,
          searchIndex:
            (selectedEntityType as ExploreSearchIndex) ?? SearchIndex.TABLE,
          queryFilter,
          pageNumber: 1,
          pageSize: PAGE_SIZE,
          includeDeleted: false,
        });
        const sources = data.hits.hits.map((hit) => hit._source);
        setData(sources);
        selectRef.current?.focus();
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.entity-fetch-error', {
            entity: t('label.suggestion-lowercase-plural'),
          })
        );
      }
    },
    [selectedEntityType, queryFilter]
  );

  const debounceOnSearch = useCallback(debounce(getSearchResults, 300), [
    getSearchResults,
  ]);

  const entityTypeSelectOptions = useMemo(() => {
    return entityData.map((entity) => {
      const Icon = getEntityNodeIcon(entity.type);

      return {
        value: entity.type,
        label: (
          <div className="d-flex items-center">
            <Icon height={16} name="entity-icon" width={16} />
            <span className="m-l-xs">{t(entity.label)}</span>
          </div>
        ),
      };
    });
  }, [t]);

  const nodeSelectOptions = useMemo(() => {
    return data.map((entity) => ({
      value: entity.fullyQualifiedName,
      label: (
        <Button
          block
          className="d-flex items-center node-suggestion-option-btn"
          data-testid={`node-suggestion-${entity.fullyQualifiedName}`}
          key={entity.fullyQualifiedName}
          type="text"
          onClick={(e) => {
            e.stopPropagation(); // Prevent select from closing
            onSelectHandler?.(entity as EntityReference);
          }}>
          <div className="d-flex items-center w-full overflow-hidden">
            <img
              alt={get(entity, 'serviceType', '') || entity.name}
              className="m-r-xs"
              height="16px"
              src={serviceUtilClassBase.getServiceTypeLogo(entity)}
              width="16px"
            />
            <div className="d-flex align-start flex-column flex-1">
              {entity.entityType === EntityType.TABLE && (
                <p className="d-block text-xs text-grey-muted p-b-xss break-all whitespace-normal text-left">
                  {getSuggestionLabelHeading(
                    entity.fullyQualifiedName ?? '',
                    entity.entityType as string
                  )}
                </p>
              )}
              <p className="text-xs text-grey-muted w-max-400 truncate line-height-normal">
                {entity.name}
              </p>
              <p className="w-max-400 text-sm font-medium truncate">
                {getEntityName(entity)}
              </p>
            </div>
          </div>
        </Button>
      ),
    }));
  }, [data, getSuggestionLabelHeading]);

  const handleChange = useCallback(
    (value: string): void => {
      setSearchValue(value);
      debounceOnSearch(value);
    },
    [debounceOnSearch]
  );

  useEffect(() => {
    getSearchResults(searchValue);
  }, [selectedEntityType]);

  const Icon = getEntityNodeIcon(selectedEntityType);

  return (
    <Box
      className="add-stream-node"
      data-testid="suggestion-node"
      sx={{
        margin: '12px 20px 12px 20px',
        minWidth: '278px',
      }}>
      <Typography
        sx={{
          fontWeight: 500,
          fontSize: '16px',
          textAlign: 'left',
          marginBottom: '12px',
        }}>
        Add Upstream Node
      </Typography>

      <Stack direction="row" spacing={3} alignItems="center">
        <Typography
          sx={{
            fontWeight: 400,
            fontSize: '16px',
          }}>
          Select Type
        </Typography>
        <Box sx={{ flex: 1 }}>
          <Select
            className="lineage-node-searchbox"
            data-testid="entity-type-select"
            open={isEntityTypeSelectOpen}
            options={entityTypeSelectOptions}
            placeholder={t('label.select-field', {
              field: t('label.type'),
            })}
            value={selectedEntityType}
            onBlur={() => setIsEntityTypeSelectOpen(false)}
            onChange={(value) => setSelectedEntityType(value)}
            onClick={(e) => e.stopPropagation()}
            onFocus={() => setIsEntityTypeSelectOpen(true)}
          />
        </Box>
      </Stack>

      {selectedEntityType && (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{
            marginTop: '12px',
            marginBottom: '12px',
          }}>
          <Icon height={16} name="entity-icon" width={16} />
          <Box sx={{ flex: 1 }}>
            <Select
              autoFocus
              showSearch
              className="lineage-node-searchbox"
              data-testid="node-search-box"
              filterOption={false}
              open={isOpen}
              options={nodeSelectOptions}
              placeholder={`${t('label.search-for-type', {
                type: capitalize(selectedEntityType),
              })}s...`}
              popupClassName="lineage-suggestion-select-menu"
              ref={selectRef}
              onBlur={() => setIsOpen(false)}
              onClick={(e) => e.stopPropagation()}
              onFocus={() => setIsOpen(true)}
              onSearch={handleChange}
            />
          </Box>
        </Stack>
      )}
    </Box>
  );
};

export default NodeSuggestionsAddStream;
