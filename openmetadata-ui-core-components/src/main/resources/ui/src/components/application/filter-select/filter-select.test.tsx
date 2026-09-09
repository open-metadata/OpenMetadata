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
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilterSelect } from './filter-select';
import type { FilterSelectProps } from './filter-select.types';

// The test env registers no i18n backend, so resolve the keys this component
// renders to their en-us texts; everything else falls through as the raw key.
const EN_LABELS: Record<string, string> = {
  'label.apply': 'Apply',
  'label.cancel': 'Cancel',
  'label.clear-all': 'Clear all',
  'label.loading': 'Loading…',
  'label.no-data-found': 'No data found',
  'label.search': 'Search',
  'label.select-all': 'Select all',
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => EN_LABELS[key] ?? key,
  }),
}));

const OPTIONS = [
  { value: 'snowflake', label: 'Snowflake', count: 12 },
  { value: 'bigquery', label: 'BigQuery', count: 8 },
  { value: 'redshift', label: 'Redshift', count: 3 },
];

const renderFilter = (props: Partial<FilterSelectProps> = {}) => {
  const onChange = vi.fn();

  render(
    <FilterSelect
      isOpen
      label="Service"
      options={OPTIONS}
      selectedValues={[]}
      onChange={onChange}
      {...props}
    />
  );

  return { onChange };
};

describe('FilterSelect', () => {
  it('renders one row per option with its count', () => {
    renderFilter();

    expect(screen.getAllByRole('menuitemcheckbox')).toHaveLength(3);
    expect(screen.getByText('Snowflake')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('hides counts when hideCounts is set', () => {
    renderFilter({ hideCounts: true });

    expect(screen.queryByText('12')).not.toBeInTheDocument();
  });

  it('applies a toggle immediately in immediate mode', () => {
    const { onChange } = renderFilter();

    fireEvent.click(screen.getByText('Snowflake'));

    expect(onChange).toHaveBeenCalledWith(['snowflake']);
  });

  it('keeps values selected under another search when toggling (staged)', () => {
    const { onChange } = renderFilter({
      commitMode: 'staged',
      selectedValues: ['redshift'],
    });

    fireEvent.click(screen.getByText('Snowflake'));

    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('apply-filter-btn'));

    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining(['redshift', 'snowflake'])
    );
  });

  it('resyncs staged selections on a controlled programmatic open', () => {
    const onChange = vi.fn();
    const props = {
      commitMode: 'staged' as const,
      label: 'Service',
      options: OPTIONS,
      onChange,
    };
    const { rerender } = render(
      <FilterSelect {...props} isOpen={false} selectedValues={['redshift']} />
    );

    rerender(<FilterSelect {...props} isOpen selectedValues={['snowflake']} />);
    fireEvent.click(screen.getByTestId('apply-filter-btn'));

    expect(onChange).toHaveBeenCalledWith(['snowflake']);
  });

  it('does not commit staged toggles on cancel', () => {
    const { onChange } = renderFilter({ commitMode: 'staged' });

    fireEvent.click(screen.getByText('Snowflake'));
    fireEvent.click(screen.getByTestId('cancel-filter-btn'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders the null option through the same row component', () => {
    renderFilter({
      nullOption: { value: 'OM_NULL_FIELD', label: 'No Service', count: 5 },
    });

    const rows = screen.getAllByRole('menuitemcheckbox');

    expect(rows).toHaveLength(4);
    expect(rows[0]).toHaveTextContent('No Service');
  });

  it('select all toggles every displayed value row, not the null option', () => {
    const { onChange } = renderFilter({
      showSelectAll: true,
      nullOption: { value: 'OM_NULL_FIELD', label: 'No Service' },
    });

    fireEvent.click(screen.getByLabelText('Select all'));

    expect(onChange).toHaveBeenCalledWith([
      'snowflake',
      'bigquery',
      'redshift',
    ]);
  });

  it('deselecting select all keeps selections hidden by the search', () => {
    const { onChange } = renderFilter({
      searchable: true,
      showSelectAll: true,
      selectedValues: ['snowflake', 'bigquery', 'redshift'],
    });

    fireEvent.change(screen.getByPlaceholderText('Search'), {
      target: { value: 'snow' },
    });
    fireEvent.click(screen.getByLabelText('Select all'));

    expect(onChange).toHaveBeenCalledWith(['bigquery', 'redshift']);
  });

  it('filters locally when no onSearch is given', () => {
    renderFilter({ searchable: true });

    fireEvent.change(screen.getByPlaceholderText('Search'), {
      target: { value: 'big' },
    });

    expect(screen.getAllByRole('menuitemcheckbox')).toHaveLength(1);
    expect(screen.getByText('BigQuery')).toBeInTheDocument();
  });

  it('delegates filtering to onSearch when given', () => {
    const onSearch = vi.fn();
    renderFilter({ searchable: true, onSearch });

    fireEvent.change(screen.getByPlaceholderText('Search'), {
      target: { value: 'big' },
    });

    expect(onSearch).toHaveBeenCalledWith('big');
    expect(screen.getAllByRole('menuitemcheckbox')).toHaveLength(3);
  });

  it('surfaces a selected value missing from the options', () => {
    renderFilter({
      selectedValues: ['mysql'],
      resolveMissingLabel: (value) => value.toUpperCase(),
    });

    expect(screen.getByText('MYSQL')).toBeInTheDocument();
  });

  it('single select applies the clicked value and reports one value', () => {
    const { onChange } = renderFilter({ selectionMode: 'single' });

    fireEvent.click(screen.getByText('BigQuery'));

    expect(onChange).toHaveBeenCalledWith(['bigquery']);
  });

  it('shows the selection count in the trigger', () => {
    renderFilter({
      selectedValues: ['snowflake', 'bigquery'],
      'data-testid': 'service-filter',
    });

    expect(screen.getByTestId('service-filter')).toHaveTextContent(
      'Service · 2'
    );
  });

  it('renders an already-rendered node icon and a helper text', () => {
    renderFilter({
      helperText: 'Pick values to refine',
      options: [
        {
          value: 'snowflake',
          label: 'Snowflake',
          icon: <img alt="" data-testid="node-icon" src="snowflake.svg" />,
        },
      ],
    });

    expect(screen.getByTestId('node-icon')).toBeInTheDocument();
    expect(screen.getByText('Pick values to refine')).toBeInTheDocument();
  });

  it('shows the empty state when nothing is displayed', () => {
    renderFilter({ options: [] });

    expect(screen.getByText('No data found')).toBeInTheDocument();
  });
});
