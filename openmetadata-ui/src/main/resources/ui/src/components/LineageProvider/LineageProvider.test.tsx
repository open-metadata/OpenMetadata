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
import { act, render } from '@testing-library/react';
import React from 'react';
import { getLineageDataByFQN } from '../../rest/lineageAPI';
import LineageProvider from './LineageProvider';

const mockLocation = {
  search: '',
  pathname: '/lineage',
};

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockReturnValue({ push: jest.fn(), listen: jest.fn() }),
  useLocation: jest.fn().mockImplementation(() => mockLocation),
  useParams: jest.fn().mockReturnValue({
    fqn: 'table1',
  }),
}));

jest.mock('../../rest/lineageAPI', () => ({
  getLineageDataByFQN: jest.fn(),
}));

describe('LineageProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Lineage component and fetches data', async () => {
    await act(async () => {
      render(
        <LineageProvider>
          <div data-testid="children">Children</div>
        </LineageProvider>
      );
    });

    expect(getLineageDataByFQN).toHaveBeenCalled();
  });
});
