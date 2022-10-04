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

import { Empty } from 'antd';
import { AxiosError } from 'axios';
import { capitalize } from 'lodash';
import React, { FC, HTMLAttributes, useEffect, useState } from 'react';
import { suggestQuery } from '../../axiosAPIs/searchAPI';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { EntityType, FqnPart } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { EntityReference } from '../../generated/type/entityReference';
import jsonData from '../../jsons/en';
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
  const [data, setData] = useState<EntityReference[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [searchValue, setSearchValue] = useState<string>('');

  const getSuggestionLabel = (fqn: string, type: string, name: string) => {
    if (type === EntityType.TABLE) {
      const database = getPartialNameFromTableFQN(fqn, [FqnPart.Database]);
      const schema = getPartialNameFromTableFQN(fqn, [FqnPart.Schema]);

      return database && schema
        ? `${database}${FQN_SEPARATOR_CHAR}${schema}${FQN_SEPARATOR_CHAR}${name}`
        : name;
    } else {
      return name;
    }
  };

  useEffect(() => {
    suggestQuery({
      query: searchValue,
      searchIndex: SearchIndex[
        entityType as keyof typeof SearchIndex
      ] as ExploreSearchIndex,
      fetchSource: true,
    })
      .then((res) => {
        setData(res.map(({ _source }) => _source));
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-suggestions-error']
        );
      });
  }, [searchValue]);

  useEffect(() => {
    setIsOpen(data.length > 0);
  }, [data]);

  return (
    <div>
      <input
        className="tw-form-inputs tw-form-inputs-padding tw-w-full"
        placeholder={`Search for ${capitalize(entityType)}s...`}
        type="search"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
      />
      {data.length > 0 && isOpen ? (
        <div
          aria-labelledby="menu-button"
          aria-orientation="vertical"
          className="tw-origin-top-right tw-absolute tw-z-20
          tw-w-max tw-mt-1 tw-rounded-md tw-shadow-lg
        tw-bg-white tw-ring-1 tw-ring-black tw-ring-opacity-5 focus:tw-outline-none"
          role="menu">
          {data.map((entity) => (
            <div
              className="tw-flex tw-items-center hover:tw-bg-body-hover"
              key={entity.fullyQualifiedName}>
              <span
                className="tw-block tw-px-2 tw-py-2 tw-text-sm tw-break-all"
                onClick={() => {
                  setIsOpen(false);
                  onSelectHandler?.({
                    description: entity.description,
                    displayName: entity.displayName,
                    id: entity.id,
                    type: entity.type,
                    name: entity.name,
                    fullyQualifiedName: entity.fullyQualifiedName,
                  });
                }}>
                <img
                  alt={entity.type}
                  className="tw-inline tw-h-4 tw-mr-2"
                  src={serviceTypeLogo(entity.type)}
                />
                {getSuggestionLabel(
                  entity.fullyQualifiedName ?? '',
                  entity.type,
                  entity.name ?? ''
                )}
              </span>
            </div>
          ))}
        </div>
      ) : (
        searchValue && (
          <div className="tw-origin-top-right tw-absolute tw-z-20 tw-w-max tw-mt-1 tw-rounded-md tw-shadow-lg tw-bg-white tw-ring-1 tw-ring-black tw-ring-opacity-5 focus:tw-outline-none">
            <Empty
              description="No data found"
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
