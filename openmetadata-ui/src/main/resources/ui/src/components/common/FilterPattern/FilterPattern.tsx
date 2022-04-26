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
import { getSeparator } from '../../../utils/CommonUtils';
import { Field } from '../../Field/Field';
import { FilterPatternProps } from './filterPattern.interface';

const FilterPattern = ({
  showSeparator = true,
  checked,
  includePattern,
  excludePattern,
  handleChecked,
  getIncludeValue,
  getExcludeValue,
  type,
}: FilterPatternProps) => {
  const includeFilterChangeHandler = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = event.target.value ? event.target.value.split(',') : [];
    getIncludeValue(value, type);
  };

  const excludeFilterChangeHandler = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = event.target.value ? event.target.value.split(',') : [];
    getExcludeValue(value, type);
  };

  return (
    <div className="tw-mt-4" data-testid="filter-pattern-container">
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
        <div data-testid="field-container">
          <Field>
            <label className="tw-block tw-form-label">Include:</label>
            <input
              className="tw-form-inputs tw-relative tw-px-2 tw-py-2"
              data-testid={`filter-pattern-includes-${type}`}
              placeholder="Enter a list of strings/regex patterns as a comma separated value"
              type="text"
              value={includePattern}
              onChange={includeFilterChangeHandler}
            />
          </Field>
          <Field>
            <label className="tw-block tw-form-label">Exclude:</label>
            <input
              className="tw-form-inputs tw-relative tw-px-2 tw-py-2"
              data-testid={`filter-pattern-excludes-${type}`}
              placeholder="Enter a list of strings/regex patterns as a comma separated value"
              type="text"
              value={excludePattern}
              onChange={excludeFilterChangeHandler}
            />
          </Field>
          {showSeparator && getSeparator('')}
        </div>
      )}
    </div>
  );
};

export default FilterPattern;
