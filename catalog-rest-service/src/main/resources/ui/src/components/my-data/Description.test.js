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

import { getAllByTestId, getByTestId, render } from '@testing-library/react';
import React from 'react';
import { descriptionData } from '../../pages/my-data/index.mock';
import Description from './Description';

describe('Test Description Component', () => {
  const { testdata1, testdata2 } = descriptionData;

  it('Renders the proper HTML for description and misc details', () => {
    const { description, miscDetails } = testdata1;
    const { container } = render(
      <Description description={description} miscDetails={miscDetails} />
    );
    const descriptionElement = getByTestId(container, 'description');
    const miscElements = getAllByTestId(container, 'misc-details');

    expect(descriptionElement.textContent).toBe(
      'Metric to determine rate of checkouts across the marketplace'
    );
    expect(miscElements.length).toBe(5);
  });

  it('Renders the proper HTML for description and no misc details', () => {
    const { description, miscDetails } = testdata2;
    const { queryByTestId, container } = render(
      <Description description={description} miscDetails={miscDetails} />
    );

    expect(queryByTestId('misc-details-container')).toBeNull();

    const descriptionElement = getByTestId(container, 'description');

    expect(descriptionElement.textContent).toBe(
      'Dashboard captures the top selling products across the marketplace per hour'
    );
  });

  it('Renders the proper HTML for default data', () => {
    const { queryByTestId, container } = render(<Description description="" />);

    expect(queryByTestId('misc-details-container')).toBeNull();

    const descriptionElement = getByTestId(container, 'description');

    expect(descriptionElement.textContent).toBe('');
  });
});
