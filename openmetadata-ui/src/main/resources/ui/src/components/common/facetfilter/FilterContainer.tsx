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

import classNames from 'classnames';
import React, { FunctionComponent } from 'react';
import { countBackground } from '../../../utils/styleconstant';
import { FilterContainerProp } from './FacetTypes';
const FilterContainer: FunctionComponent<FilterContainerProp> = ({
  name,
  count,
  onSelect,
  isSelected,
  type,
  isDisabled = false,
}: FilterContainerProp) => {
  return (
    <div className="filter-group tw-mb-2" data-testid="filter-container">
      <input
        checked={isSelected}
        className={classNames('tw-mr-1 custom-checkbox', {
          'tw-cursor-not-allowed': isDisabled,
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
          'filters-title tw-w-40 tw-truncate custom-checkbox-label',
          { 'tw-text-grey-muted': isDisabled }
        )}>
        {name.startsWith('Tier.Tier') ? name.split('.')[1] : name}
      </div>
      <div
        className="tw-ml-auto tw-py-1 tw-px-2 tw-border tw-rounded tw-text-xs"
        style={{ background: countBackground }}>
        <span data-testid="filter-count">{count}</span>
      </div>
    </div>
  );
};

export default FilterContainer;
