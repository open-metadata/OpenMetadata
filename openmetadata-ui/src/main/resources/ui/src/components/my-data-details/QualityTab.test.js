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

import { getAllByTestId, getByTestId, render } from '@testing-library/react';
import React from 'react';
import QualityTab from './QualityTab';

describe('Test QualityTab Component', () => {
  it('Renders all the components to be present in the tab', () => {
    const { container } = render(<QualityTab />);
    const addTestButton = getByTestId(container, 'add-test-button');

    expect(addTestButton).toBeInTheDocument();

    const qualityCards = getAllByTestId(container, 'quality-card-container');

    expect(qualityCards.length).toBe(3);

    const datacenterTable = getByTestId(
      container,
      'datacenter-details-container'
    );

    expect(datacenterTable).toBeInTheDocument();

    const testsTable = getByTestId(container, 'tests-details-container');

    expect(testsTable).toBeInTheDocument();
  });
});
