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
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Table } from './table';

describe('Table', () => {
  it('can omit the selection cell for a full-width synthetic row', () => {
    render(
      <Table
        aria-label="Metrics"
        selectionBehavior="toggle"
        selectionMode="multiple">
        <Table.Header>
          <Table.Head id="metric" label="Metric" />
          <Table.Head id="description" label="Description" />
        </Table.Header>
        <Table.Body>
          <Table.Row id="metric-row">
            <Table.Cell>Gross margin</Table.Cell>
            <Table.Cell>Margin after costs</Table.Cell>
          </Table.Row>
          <Table.Row hideSelectionCell id="group-row">
            <Table.Cell colSpan={3}>Profitability</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>
    );

    const metricRow = screen.getByText('Gross margin').closest('tr');
    const groupRow = screen.getByText('Profitability').closest('tr');

    expect(metricRow).not.toBeNull();
    expect(groupRow).not.toBeNull();
    expect(
      within(metricRow as HTMLElement).getByRole('checkbox')
    ).toBeVisible();
    expect(
      within(groupRow as HTMLElement).queryByRole('checkbox')
    ).not.toBeInTheDocument();
    expect(screen.getByText('Profitability').closest('td')).toHaveAttribute(
      'colspan',
      '3'
    );
  });
});
