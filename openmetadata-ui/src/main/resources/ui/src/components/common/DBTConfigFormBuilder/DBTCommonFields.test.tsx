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

import { render, screen } from '@testing-library/react';
import React from 'react';
import DBTCommonFields from './DBTCommonFields.component';
import { dbtParsingTimeoutLimit } from './DBTFormConstants';

const mockProps = {
  dbtUpdateDescriptions: false,
  includeTags: true,
  descriptionId: 'test-id',
  dbtClassificationName: 'DBT',
  enableDebugLog: false,
  parsingTimeoutLimit: dbtParsingTimeoutLimit,
};

describe('DBTCommonFields', () => {
  it('Should render the fields', () => {
    render(<DBTCommonFields {...mockProps} />);

    const dbtClassificationName = screen.getByTestId('dbt-classification-name');
    const loggerLevel = screen.getByTestId('toggle-button-enable-debug-log');
    const dbtUpdateDescriptions = screen.getByTestId('test-id');
    const includeTags = screen.getByTestId('toggle-button-include-tags');

    expect(dbtClassificationName).toBeInTheDocument();
    expect(loggerLevel).toBeInTheDocument();
    expect(dbtUpdateDescriptions).toBeInTheDocument();
    expect(includeTags).toBeInTheDocument();
  });
});
