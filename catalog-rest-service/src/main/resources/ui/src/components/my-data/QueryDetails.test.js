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

import { getByTestId, render } from '@testing-library/react';
import React from 'react';
import { queryDetailsData } from '../../pages/my-data/index.mock';
import QueryDetails from './QueryDetails';

describe('Test QueryDetails Component', () => {
  const { testdata1, testdata2 } = queryDetailsData;

  it('Renders the proper HTML when there are no query tags', () => {
    const { queryByTestId, container } = render(
      <QueryDetails queryDetails={testdata1} />
    );

    expect(queryByTestId('tag')).toBeNull();

    const runDetailsElement = getByTestId(container, 'run-details');
    const rowCountElement = getByTestId(container, 'row-count');
    const colCountElement = getByTestId(container, 'col-count');
    const dataTypeCountElement = getByTestId(container, 'datatype-count');

    expect(runDetailsElement.textContent).toBe('Suresh on Jan 15, 2019 1:25pm');
    expect(rowCountElement.textContent).toBe('1454');
    expect(colCountElement.textContent).toBe('15');
    expect(dataTypeCountElement.textContent).toBe('3');
  });

  it('Renders the proper HTML for multiple query tags', () => {
    const { getAllByTestId, container } = render(
      <QueryDetails queryDetails={testdata2} />
    );
    const tagList = getAllByTestId('query-tag');

    expect(tagList.length).toBe(3);

    const runDetailsElement = getByTestId(container, 'run-details');
    const rowCountElement = getByTestId(container, 'row-count');
    const colCountElement = getByTestId(container, 'col-count');
    const dataTypeCountElement = getByTestId(container, 'datatype-count');

    expect(runDetailsElement.textContent).toBe('Sanket on Jan 25, 2020 3:45am');
    expect(rowCountElement.textContent).toBe('1234');
    expect(colCountElement.textContent).toBe('54');
    expect(dataTypeCountElement.textContent).toBe('7');
  });
});
