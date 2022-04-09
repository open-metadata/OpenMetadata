import { capitalize } from 'lodash';
import React from 'react';
import { FilterPatternType } from '../../../enums/filterPattern.enum';
import { getSeparator } from '../../../utils/CommonUtils';
import { Field } from '../../Field/Field';
import ReactSelectMultiInput from '../react-select-component/ReactSelectMultiInput';

type Props = {
  checked: boolean;
  showSeparator?: boolean;
  handleChecked: (e: boolean) => void;
  type: FilterPatternType;
  getExcludeValue: (value: Array<string>, type: FilterPatternType) => void;
  getIncludeValue: (value: Array<string>, type: FilterPatternType) => void;
};

const FilterPattern = ({
  showSeparator = true,
  checked,
  handleChecked,
  getIncludeValue,
  getExcludeValue,
  type,
}: Props) => {
  return (
    <Field>
      <div className="tw-flex tw-items-center">
        <input
          checked={checked}
          className="tw-mr-3 custom-checkbox"
          data-testid={`${type}-filter-pattern-checkbox`}
          id={`${type}FilterPatternCheckbox`}
          name={`${type}FilterPatternCheckbox`}
          type="checkbox"
          onChange={(e) => handleChecked(e.target.checked)}
        />

        <label htmlFor={`${type}FilterPatternCheckbox`}>{`${capitalize(
          type
        )} Filter Pattern`}</label>
      </div>
      {checked && (
        <div>
          <Field>
            <label className="tw-block tw-form-label">Include:</label>
            <ReactSelectMultiInput
              getTagValue={(data) => getIncludeValue(data, type)}
              placeholder="Type include filter pattern and hit enter"
            />
          </Field>
          <Field>
            <label className="tw-block tw-form-label">Exclude:</label>
            <ReactSelectMultiInput
              getTagValue={(data) => getExcludeValue(data, type)}
              placeholder="Type exclude filter pattern and hit enter"
            />
          </Field>
          {showSeparator && getSeparator('')}
        </div>
      )}
    </Field>
  );
};

export default FilterPattern;
