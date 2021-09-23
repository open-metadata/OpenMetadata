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

/* eslint-disable @typescript-eslint/camelcase */

import { getAllByTestId, render } from '@testing-library/react';
import React from 'react';
import FacetFilter from './FacetFilter';

const onSelectHandler = jest.fn();
const onClearFilter = jest.fn();
const aggregations = [
  {
    title: 'Filter 1',
    buckets: [{ key: 'test', doc_count: 5 }],
  },
  {
    title: 'Filter 2',
    buckets: [{ key: 'test', doc_count: 5 }],
  },
  {
    title: 'Filter 3',
    buckets: [{ key: 'test', doc_count: 5 }],
  },
];
const filters = {
  tags: ['test', 'test2'],
  service: ['test', 'test2'],
  'service type': ['test', 'test2'],
  tier: ['test', 'test2'],
};

describe('Test FacetFilter Component', () => {
  it('Component should render', () => {
    const { container } = render(
      <FacetFilter
        aggregations={aggregations}
        filters={filters}
        onClearFilter={onClearFilter}
        onSelectHandler={onSelectHandler}
      />
    );
    const filterHeading = getAllByTestId(container, 'filter-heading');

    expect(filterHeading.length).toBe(3);
  });
});
