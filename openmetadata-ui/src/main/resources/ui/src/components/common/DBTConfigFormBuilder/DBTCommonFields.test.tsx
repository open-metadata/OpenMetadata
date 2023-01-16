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

import { getByTestId, render } from '@testing-library/react';
import React from 'react';
import DBTCommonFields from './DBTCommonFields.component';

const mockProps = {
  dbtUpdateDescriptions: false,
  descriptionId: 'test-id',
  dbtClassificationName: 'DBT',
  handleUpdateDescriptions: jest.fn(),
  handleUpdateDBTClassification: jest.fn(),
};

describe('DBTCommonFields', () => {
  it('Component should render properly', () => {
    const { container } = render(<DBTCommonFields {...mockProps} />);

    const switchLabel = getByTestId(container, 'test-id');
    const switchButton = getByTestId(container, 'description-switch');
    const switchDescription = getByTestId(container, 'switch-description');

    expect(switchLabel).toBeInTheDocument();
    expect(switchButton).toBeInTheDocument();
    expect(switchDescription).toBeInTheDocument();

    const classificationLabel = getByTestId(
      container,
      'dbt-classification-label'
    );
    const classificationInput = getByTestId(
      container,
      'dbt-classification-name'
    );
    const classificationDescription = getByTestId(
      container,
      'dbt-classification-description'
    );

    expect(classificationLabel).toBeInTheDocument();
    expect(classificationInput).toBeInTheDocument();
    expect(classificationDescription).toBeInTheDocument();
  });
});
