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

import { Tooltip } from 'antd';
import classNames from 'classnames';
import { isNil } from 'lodash';
import React, { FunctionComponent } from 'react';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { getCountBadge } from '../../../utils/CommonUtils';
import { FilterContainerProp } from './facetFilter.interface';

const FilterContainer: FunctionComponent<FilterContainerProp> = ({
  name,
  count,
  onSelect,
  isSelected,
  type = '',
  isDisabled = false,
  label,
}) => {
  const getFilterName = (name = '') => {
    const formattedName = name.startsWith(`Tier${FQN_SEPARATOR_CHAR}Tier`)
      ? name.split(FQN_SEPARATOR_CHAR)[1]
      : name;

    return (
      <Tooltip placement="top" title={formattedName} trigger="hover">
        {label || formattedName}
      </Tooltip>
    );
  };

  return (
    <label
      className="filter-group justify-between m-b-xs cursor-pointer"
      data-testid={`filter-container-${name}`}>
      <div className="flex">
        <input
          checked={isSelected}
          className={classNames('m-r-xs custom-checkbox', {
            'cursor-not-allowed': isDisabled,
          })}
          data-testid="checkbox"
          disabled={isDisabled}
          id={name}
          type="checkbox"
          onChange={() => {
            onSelect(!isSelected, name, type);
          }}
        />
        <div
          className={classNames(
            'filters-title w-32 truncate custom-checkbox-label',
            { 'text-grey-muted': isDisabled }
          )}
          data-testid="checkbox-label">
          {getFilterName(name)}
        </div>
      </div>
      {!isNil(count) &&
        getCountBadge(count, classNames('p-y-0 p-x-0'), isSelected)}
    </label>
  );
};

export default FilterContainer;
