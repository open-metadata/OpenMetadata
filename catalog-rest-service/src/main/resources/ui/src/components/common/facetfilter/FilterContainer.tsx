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
    <div
      className={`filter-group tw-mb-2 ${count > 0 ? '' : 'tw-text-gray-500'}`}>
      <input
        checked={isSelected}
        className="mr-1"
        disabled={count > 0 ? false : true}
        type="checkbox"
        onClick={() => {
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
