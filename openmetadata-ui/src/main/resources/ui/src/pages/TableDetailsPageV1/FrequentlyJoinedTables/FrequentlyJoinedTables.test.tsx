/*
 *  Copyright 2024 Collate.
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
import { MemoryRouter } from 'react-router-dom';
import { FrequentlyJoinedTables } from './FrequentlyJoinedTables.component';

jest.mock('../../../utils/TableUtils', () => ({
  getJoinsFromTableJoins: jest.fn().mockReturnValue([
    {
      name: 'test',
      fullyQualifiedName: 'test',
      joinCount: 1,
    },
  ]),
}));

describe('FrequentlyJoinedTables component', () => {
  it('should render header the component', async () => {
    render(<FrequentlyJoinedTables />, {
      wrapper: MemoryRouter,
    });

    expect(
      await screen.findByTestId('frequently-joint-data-container')
    ).toBeInTheDocument();

    expect(
      await screen.findByText('label.frequently-joined-table-plural')
    ).toBeInTheDocument();
  });

  it("should show the table's name and join count", async () => {
    render(<FrequentlyJoinedTables />, {
      wrapper: MemoryRouter,
    });

    expect(await screen.findByText('test')).toBeInTheDocument();
    expect(await screen.findByText('1')).toBeInTheDocument();
  });
});
