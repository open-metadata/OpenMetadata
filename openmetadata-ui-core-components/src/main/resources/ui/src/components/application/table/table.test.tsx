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

const ROWS = [
  { id: 'r1', name: 'alpha' },
  { id: 'r2', name: 'bravo' },
];

const renderTable = (props: Partial<Parameters<typeof Table>[0]> = {}) =>
  render(
    <Table aria-label="test-table" {...props}>
      <Table.Header>
        <Table.Head isRowHeader id="name">
          Name
        </Table.Head>
      </Table.Header>
      <Table.Body>
        {ROWS.map((row) => (
          <Table.Row id={row.id} key={row.id}>
            <Table.Cell>{row.name}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );

const firstCell = () =>
  screen.getAllByRole('row')[1].querySelector('td, th') as HTMLElement;

describe('Table header accessibility', () => {
  it('names the columnheader from its title content', () => {
    renderTable();

    // The header content wrapper must stay a plain div: a role="group"
    // wrapper makes Chromium compute an empty accessible name for the
    // columnheader, breaking getByRole('columnheader', { name }).
    expect(
      screen.getByRole('columnheader', { name: 'Name' })
    ).toBeInTheDocument();
    expect(
      screen
        .getByRole('columnheader', { name: 'Name' })
        .querySelector('[role="group"]')
    ).toBeNull();
  });
});

describe('Table sizes', () => {
  it('applies the compact scale', () => {
    renderTable({ size: 'compact' });

    expect(screen.getAllByRole('row')[1]).toHaveClass('tw:h-10');
    expect(firstCell()).toHaveClass('tw:px-4', 'tw:py-2');
  });

  it('keeps sm and md unchanged', () => {
    const { unmount } = renderTable({ size: 'sm' });

    expect(screen.getAllByRole('row')[1]).toHaveClass('tw:h-14');
    unmount();

    renderTable({ size: 'md' });

    expect(screen.getAllByRole('row')[1]).toHaveClass('tw:h-18');
  });

  it('defaults to md when no size is given', () => {
    renderTable();

    expect(screen.getAllByRole('row')[1]).toHaveClass('tw:h-18');
  });
});

describe('Table selection', () => {
  it('renders a checkbox per row and a select-all for multiple selection', () => {
    renderTable({ selectionBehavior: 'toggle', selectionMode: 'multiple' });

    expect(screen.getAllByRole('checkbox')).toHaveLength(ROWS.length + 1);
  });

  it('renders no select-all control for single selection', () => {
    renderTable({ selectionBehavior: 'toggle', selectionMode: 'single' });

    expect(document.querySelector('thead input[type="checkbox"]')).toBeNull();
  });

  it('names the single-selection control so it does not just announce "checkbox"', () => {
    renderTable({ selectionBehavior: 'toggle', selectionMode: 'single' });

    // React Aria's selection slot only accepts a checkbox, so the control looks
    // like a radio but announces as a checkbox. The label carries the "one row"
    // affordance the role cannot.
    const labels = screen
      .getAllByRole('checkbox')
      .map((box) => box.getAttribute('aria-label'));

    expect(labels).toEqual(ROWS.map(() => 'Select one row'));
  });

  it('selects one row at a time in single-selection mode', async () => {
    renderTable({ selectionBehavior: 'toggle', selectionMode: 'single' });
    const rows = screen.getAllByRole('row').slice(1);
    const controlFor = (row: HTMLElement) =>
      within(row).getByRole('checkbox') as HTMLInputElement;

    controlFor(rows[0]).click();

    expect(rows[0]).toHaveAttribute('data-selected');

    controlFor(rows[1]).click();

    expect(rows[0]).not.toHaveAttribute('data-selected');
    expect(rows[1]).toHaveAttribute('data-selected');
  });
});

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
