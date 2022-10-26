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

/* eslint-disable @typescript-eslint/camelcase */

import { findByText, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router';
import ExplorePage from './ExplorePage.component';

const mockData = {
  key: 1,
  data: {
    took: 2,
    timed_out: false,
    _shards: { total: 1, successful: 1, skipped: 0, failed: 0 },
    hits: { total: { value: 16, relation: 'eq' }, max_score: null, hits: [] },
    aggregations: {
      'sterms#EntityType': {
        doc_count_error_upper_bound: 0,
        sum_other_doc_count: 0,
        buckets: [{ key: 'table', doc_count: 16 }],
      },

      'sterms#Tags': {
        doc_count_error_upper_bound: 0,
        sum_other_doc_count: 0,
        buckets: [
          { key: 'PII.NonSensitive', doc_count: 2 },
          { key: 'PII.None', doc_count: 2 },
          { key: 'PersonalData.Personal', doc_count: 2 },
          { key: 'PersonalData.SpecialCategory', doc_count: 2 },
          { key: 'PII.Sensitive', doc_count: 1 },
          { key: 'test-category.test-glossary-term-tag', doc_count: 1 },
          { key: 'test-glossary.test-glossary-term', doc_count: 1 },
        ],
      },
      'sterms#DatabaseSchema': {
        doc_count_error_upper_bound: 0,
        sum_other_doc_count: 0,
        buckets: [{ key: 'shopify', doc_count: 16 }],
      },
    },
  },
};

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockImplementation(() => ({ searchQuery: '' })),
  useHistory: jest.fn(),
  useLocation: jest
    .fn()
    .mockImplementation(() => ({ search: '', pathname: '/explore' })),
}));

jest.mock('../../AppState', () => ({
  updateExplorePageTab: jest.fn().mockReturnValue(''),
}));

jest.mock('../../components/Explore/Explore.component', () => {
  return jest.fn().mockReturnValue(<p>Explore Component</p>);
});

jest.mock('../../axiosAPIs/miscAPI', () => ({
  searchData: jest.fn().mockImplementation(() => Promise.resolve(mockData)),
}));

describe('Test Explore page', () => {
  it('Page Should render', async () => {
    const { container } = render(<ExplorePage />, { wrapper: MemoryRouter });

    const explorePage = await findByText(container, /Explore Component/i);

    expect(explorePage).toBeInTheDocument();
  });
});
