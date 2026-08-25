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

import { fireEvent, screen, within } from '@testing-library/react';
import Table from '../Table';
import { ParityAdapter, runTableParitySuite } from './tableParity.shared';

/** Control access for the legacy antd DOM. Assertions stay in the shared suite. */
const antdAdapter: ParityAdapter = {
  activate: (element) => fireEvent.click(element),
  clickNextPage: () => {
    fireEvent.click(
      document.querySelector('.ant-pagination-next button') as HTMLElement
    );
  },
  isBordered: () =>
    Boolean(document.querySelector('.ant-table-bordered')),
  getTableLayout: () =>
    (document.querySelector('table') as HTMLElement).style.tableLayout ===
    'fixed'
      ? 'fixed'
      : 'auto',
  getIndentPx: (label) => {
    const row = screen
      .getAllByRole('row')
      .find((candidate) => within(candidate).queryByText(label));
    const indent = (row as HTMLElement).querySelector(
      '.ant-table-row-indent'
    ) as HTMLElement | null;

    return indent ? parseFloat(indent.style.paddingLeft || '0') : 0;
  },
  openFilter: () => {
    fireEvent.click(
      document.querySelector('.ant-table-filter-trigger') as HTMLElement
    );
  },
  queryPageSizeControl: () => document.querySelector('.ant-pagination-options'),
  getSelectAllControl: () =>
    document.querySelector(
      'thead .ant-table-selection input[type="checkbox"]'
    ) as HTMLElement | null,
  queryPager: () => document.querySelector('.ant-pagination'),
  toggleExpander: (label) => {
    const row = screen
      .getAllByRole('row')
      .find((candidate) => within(candidate).queryByText(label));
    fireEvent.click(within(row as HTMLElement).getByTestId('expand-icon'));
  },
};

runTableParitySuite('Table (legacy)', Table, antdAdapter);
