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
