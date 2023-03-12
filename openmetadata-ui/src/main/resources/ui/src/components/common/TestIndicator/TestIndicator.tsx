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

import classNames from 'classnames';
import React from 'react';
import { TestIndicatorProps } from '../../TableProfiler/TableProfiler.interface';
import './testIndicator.less';

const TestIndicator: React.FC<TestIndicatorProps> = ({ value, type }) => {
  return (
    <span
      className="tw-flex tw-gap-1.5 tw-items-center"
      data-testid="indicator-container">
      <span
        className={classNames('test-indicator', type.toLowerCase())}
        data-testid="test-status"
      />
      <span data-testid="test-value">{value}</span>
    </span>
  );
};

export default TestIndicator;
