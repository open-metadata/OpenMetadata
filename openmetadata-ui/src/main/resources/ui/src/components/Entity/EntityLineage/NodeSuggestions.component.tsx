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

import { Button, Col, Row, Select } from 'antd';
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
  const selectRef = useRef<any>(null);

  const [data, setData] = useState<Array<SourceType>>([]);
  const [searchValue, setSearchValue] = useState<string>('');
  const [isOpen, setIsOpen] = useState(true);

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
    [entityType, queryFilter]
  );

  const debounceOnSearch = useCallback(debounce(getSearchResults, 300), [
    getSearchResults,
  ]);

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
  }, []);

  const Icon = getEntityNodeIcon(entityType);

  return (
    <Row
      className="p-md items-center"
      data-testid="suggestion-node"
      gutter={8}
      wrap={false}>
      <Col>
        <Icon height={16} name="entity-icon" width={16} />
      </Col>
      <Col flex="1">
        <Select
          autoFocus
          showSearch
          className="lineage-node-searchbox"
          data-testid="node-search-box"
          filterOption={false}
          open={isOpen}
          options={nodeSelectOptions}
          placeholder={`${t('label.search-for-type', {
            type: capitalize(entityType),
          })}s...`}
          popupClassName="lineage-suggestion-select-menu"
          ref={selectRef}
          onBlur={() => setIsOpen(false)}
          onClick={(e) => e.stopPropagation()}
          onFocus={() => setIsOpen(true)}
          onSearch={handleChange}
        />
      </Col>
    </Row>
  );
};

export default NodeSuggestions;
