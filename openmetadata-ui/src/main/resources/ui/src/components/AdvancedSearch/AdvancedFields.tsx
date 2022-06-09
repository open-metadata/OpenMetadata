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

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { startCase, uniqueId } from 'lodash';
import React, { FC } from 'react';
import { getItemLabel } from '../../utils/AdvancedSearchUtils';

interface Props {
  fields: Array<string>;
  onFieldRemove: (value: string) => void;
  onClear: () => void;
}

const AdvancedFields: FC<Props> = ({ fields, onFieldRemove, onClear }) => {
  return (
    <div className="tw-grid tw-grid-cols-4 tw-gap-2 tw-mb-3">
      {fields.map((field) => (
        <div
          className="tw-bg-white tw-border tw-border-main tw-rounded tw-p-1 tw-flex tw-justify-between"
          key={uniqueId()}>
          {startCase(getItemLabel(field))}
          <span
            className="tw-cursor-pointer"
            onClick={() => onFieldRemove(field)}>
            <FontAwesomeIcon className="tw-text-primary" icon="times" />
          </span>
        </div>
      ))}
      <span
        className="tw-text-primary tw-self-center tw-cursor-pointer"
        onClick={onClear}>
        Clear All
      </span>
    </div>
  );
};

export default AdvancedFields;
