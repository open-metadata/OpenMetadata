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
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckboxContext } from 'react-aria-components';
import { ColumnFilter } from './ColumnFilter.component';

const filters = [
  { text: 'Clickhouse', value: 'Clickhouse' },
  { text: 'PersonalData.Personal', value: 'PersonalData.Personal' },
];

describe('ColumnFilter', () => {
  it('renders its options inside a table header checkbox context', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const setSelectedKeys = jest.fn();
    const confirm = jest.fn();

    // TableV2 headers provide react-aria's slotted "selection" checkbox context.
    render(
      <CheckboxContext.Provider value={{ slots: { selection: {} } }}>
        <ColumnFilter
          visible
          clearFilters={jest.fn()}
          close={jest.fn()}
          confirm={confirm}
          filters={filters}
          prefixCls="filter"
          selectedKeys={[]}
          setSelectedKeys={setSelectedKeys}
        />
      </CheckboxContext.Provider>
    );

    await user.click(screen.getByText('Personal Data Personal'));

    expect(setSelectedKeys).toHaveBeenCalledWith(['PersonalData.Personal']);
    expect(confirm).toHaveBeenCalled();
  });

  it('shows an empty state when there are no filters', () => {
    render(
      <ColumnFilter
        visible
        clearFilters={jest.fn()}
        close={jest.fn()}
        confirm={jest.fn()}
        filters={[]}
        prefixCls="filter"
        selectedKeys={[]}
        setSelectedKeys={jest.fn()}
      />
    );

    expect(screen.getByTestId('no-filter-options')).toBeInTheDocument();
  });
});
