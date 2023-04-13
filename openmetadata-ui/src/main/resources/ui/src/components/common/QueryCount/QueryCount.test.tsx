/*
 *  Copyright 2023 Collate.
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
import QueryCount from './QueryCount.component';

jest.mock('rest/searchAPI', () => ({
  searchQuery: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve({ hits: { total: { value: 10 } } })
    ),
}));

describe('QueryCount test', () => {
  it('component should render', async () => {
    render(<QueryCount tableId="testID" />);

    expect(
      await screen.findByText('10 label.query-plural')
    ).toBeInTheDocument();
  });
});
