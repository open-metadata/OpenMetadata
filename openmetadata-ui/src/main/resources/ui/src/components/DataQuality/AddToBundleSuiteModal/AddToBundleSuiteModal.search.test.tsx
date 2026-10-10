/*
 *  Copyright 2026 Collate.
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
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { MOCK_TEST_CASE } from '../../../mocks/TestSuite.mock';
import {
  addTestCasesToLogicalTestSuiteBulk,
  getListTestSuitesBySearch,
} from '../../../rest/testAPI';
import AddToBundleSuiteModal from './AddToBundleSuiteModal.component';

jest.mock('../../../rest/testAPI', () => ({
  getListTestSuitesBySearch: jest.fn(),
  addTestCasesToLogicalTestSuiteBulk: jest.fn(),
}));

const initialSuite = { id: 'suite-1', name: 'Shared suite' };
const serverMatch = { id: 'suite-16', name: 'Shared suite archive' };
const mockGetSuites = getListTestSuitesBySearch as jest.MockedFunction<
  typeof getListTestSuitesBySearch
>;
const mockAddTestCases =
  addTestCasesToLogicalTestSuiteBulk as jest.MockedFunction<
    typeof addTestCasesToLogicalTestSuiteBulk
  >;
let user: ReturnType<typeof userEvent.setup>;

const renderModal = () =>
  render(
    <MemoryRouter>
      <AddToBundleSuiteModal
        open
        selectedTestCases={[MOCK_TEST_CASE[0]]}
        onAddedToExisting={jest.fn()}
        onCancel={jest.fn()}
      />
    </MemoryRouter>
  );

describe('bundle suite search with the core combobox', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    mockGetSuites.mockImplementation(async ({ q } = {}) => ({
      data: q ? [initialSuite, serverMatch] : [initialSuite],
      paging: { total: q ? 2 : 16 },
    }));
    mockAddTestCases.mockResolvedValue(initialSuite);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('searches an exact loaded label and exposes additional server matches', async () => {
    renderModal();
    const input = screen.getByRole('combobox');
    await act(async () => user.click(input));

    expect(
      await screen.findByRole('option', { name: initialSuite.name })
    ).toBeInTheDocument();

    fireEvent.change(input, { target: { value: initialSuite.name } });
    await act(async () => jest.advanceTimersByTime(400));

    expect(
      await screen.findByRole('option', { name: serverMatch.name })
    ).toBeInTheDocument();
    expect(screen.getByTestId('add-button')).toBeDisabled();
  });

  it('selects an option without searching its label and submits that suite', async () => {
    renderModal();
    await act(async () => user.click(screen.getByRole('combobox')));
    const option = await screen.findByRole('option', {
      name: initialSuite.name,
    });
    await act(async () => user.click(option));
    await act(async () => jest.advanceTimersByTime(400));

    expect(getListTestSuitesBySearch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('combobox')).toHaveValue(initialSuite.name);
    expect(screen.getByTestId('add-button')).toBeEnabled();

    await act(async () => user.click(screen.getByTestId('add-button')));

    expect(addTestCasesToLogicalTestSuiteBulk).toHaveBeenCalledWith(
      initialSuite.id,
      expect.objectContaining({ includeIds: [MOCK_TEST_CASE[0].id] })
    );
  });

  it('clears the selected suite when the user edits its label', async () => {
    renderModal();
    const input = screen.getByRole('combobox');
    await act(async () => user.click(input));
    await act(async () =>
      user.click(screen.getByRole('option', { name: initialSuite.name }))
    );
    fireEvent.change(input, { target: { value: 'Another suite' } });
    await act(async () => jest.advanceTimersByTime(400));

    expect(input).toHaveValue('Another suite');
    expect(screen.getByTestId('add-button')).toBeDisabled();
  });
});
