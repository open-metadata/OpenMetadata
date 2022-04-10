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
  includePattern: Array<string> | undefined;
  excludePattern: Array<string> | undefined;
  type: FilterPatternType;
  getExcludeValue: (value: Array<string>, type: FilterPatternType) => void;
  getIncludeValue: (value: Array<string>, type: FilterPatternType) => void;
};

const FilterPattern = ({
  showSeparator = true,
  checked,
  includePattern,
  excludePattern,
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
              initialData={includePattern}
              placeholder="Type include filter pattern and hit enter"
            />
          </Field>
          <Field>
            <label className="tw-block tw-form-label">Exclude:</label>
            <ReactSelectMultiInput
              getTagValue={(data) => getExcludeValue(data, type)}
              initialData={excludePattern}
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
