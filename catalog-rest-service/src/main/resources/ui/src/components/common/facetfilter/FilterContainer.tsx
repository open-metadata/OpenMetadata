/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import React, { FunctionComponent } from 'react';
import { countBackground } from '../../../utils/styleconstant';
import { FilterContainerProp } from './FacetTypes';
const FilterContainer: FunctionComponent<FilterContainerProp> = ({
  name,
  count,
  onSelect,
  isSelected,
  type,
}: FilterContainerProp) => {
  return (
    <div className="filter-group tw-mb-2">
      <input
        checked={isSelected}
        className="mr-1"
        // disabled={count > 0 ? false : true}
        type="checkbox"
        onChange={() => {
          onSelect(!isSelected, name, type);
        }}
      />
      <div className="filters-title tw-w-40 tw-truncate">
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
