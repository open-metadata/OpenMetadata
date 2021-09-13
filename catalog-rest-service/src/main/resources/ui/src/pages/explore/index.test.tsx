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

import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { getFilterString } from '../../utils/FilterUtils';
import ExplorePage from './index';
import { mockResponse } from './index.mock';
jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
  useParams: jest.fn().mockImplementation(() => ({ searchQuery: '' })),
  useLocation: jest.fn().mockImplementation(() => ({ search: '' })),
}));

jest.mock('../../axiosAPIs/miscAPI', () => ({
  searchData: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockResponse })),
}));
jest.mock('../../utils/FilterUtils', () => ({
  getFilterString: jest.fn().mockImplementation(() => 'user.address'),
}));

describe('Test Explore page', () => {
  it('Should Call Search API', async () => {
    await act(async () => {
      render(<ExplorePage />);
    });

    expect(await screen.findByTestId('no-data-found')).toBeInTheDocument();
  });

  it('getFilterString should return filter as string', async () => {
    await act(async () => {
      render(<ExplorePage />);
    });

    expect(getFilterString).toEqual(getFilterString);
  });
});
