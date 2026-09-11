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
  'label.apply-count': 'Apply ({{count}})',
  'label.cancel': 'Cancel',
  'label.clear-all': 'Clear all',
  'label.count-selected': '{{count}} selected',
  'label.loading': 'Loading…',
  'label.no-data-found': 'No data found',
  'label.none-selected': 'None selected',
  'label.remove-filter': 'Remove filter',
  'label.search': 'Search',
  'label.select-all': 'Select all',
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const text = EN_LABELS[key] ?? key;

      return Object.entries(options ?? {}).reduce(
        (resolved, [name, value]) =>
          resolved.replace(`{{${name}}}`, String(value)),
        text
      );
    },
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

    fireEvent.click(screen.getByTestId('update-btn'));

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
    fireEvent.click(screen.getByTestId('update-btn'));

    expect(onChange).toHaveBeenCalledWith(['snowflake']);
  });

  it('does not commit staged toggles on cancel', () => {
    const { onChange } = renderFilter({ commitMode: 'staged' });

    fireEvent.click(screen.getByText('Snowflake'));
    fireEvent.click(screen.getByTestId('close-btn'));

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

    expect(screen.getByTestId('service-filter')).toHaveTextContent('Service');
    expect(screen.getByTestId('filter-count-badge')).toHaveTextContent('2');
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

  it('renders an array icon node without throwing', () => {
    renderFilter({
      options: [
        {
          value: 'snowflake',
          label: 'Snowflake',
          icon: [
            <img alt="" key="a" src="a.svg" />,
            <img alt="" key="b" src="b.svg" />,
          ],
        },
      ],
    });

    expect(screen.getByText('Snowflake')).toBeInTheDocument();
  });

  it('renders a borderless trigger by default and a bordered one on request', () => {
    const { rerender } = render(
      <FilterSelect
        data-testid="trigger-test"
        label="Service"
        options={OPTIONS}
        selectedValues={[]}
        triggerVariant="button"
        onChange={() => undefined}
      />
    );

    expect(screen.getByTestId('trigger-test').className).not.toContain(
      'shadow-xs-skeuomorphic'
    );

    rerender(
      <FilterSelect
        bordered
        data-testid="trigger-test"
        label="Service"
        options={OPTIONS}
        selectedValues={[]}
        triggerVariant="button"
        onChange={() => undefined}
      />
    );

    expect(screen.getByTestId('trigger-test').className).toContain(
      'shadow-xs-skeuomorphic'
    );
  });

  it('exposes the label-keyed trigger test id as well as the key-keyed one', () => {
    // The component this replaces put a second test id on an element inside
    // the trigger, keyed by visible label rather than by filter key. A dozen
    // specs click filters that way ("search-dropdown-Data Products").
    renderFilter({ 'data-testid': 'search-dropdown-tier', label: 'Tier' });

    expect(screen.getByTestId('search-dropdown-tier')).toBeInTheDocument();
    expect(screen.getByTestId('search-dropdown-Tier')).toBeInTheDocument();
  });

  it('exposes the legacy dropdown test ids the E2E suite drives', () => {
    // The Playwright suite addresses filters through the ids the component
    // this replaced used. Renaming them silently breaks ~160 references across
    // 23 spec files, so the contract is pinned here rather than in the specs.
    renderFilter({
      searchable: true,
      commitMode: 'staged',
      nullOption: { value: 'OM_NULL_FIELD', label: 'No Service' },
    });

    expect(screen.getByTestId('drop-down-menu')).toBeInTheDocument();
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
    expect(screen.getByTestId('snowflake-checkbox')).toBeInTheDocument();
    expect(screen.getByTestId('no-option-checkbox')).toBeInTheDocument();
    expect(screen.getByTestId('update-btn')).toBeInTheDocument();
    expect(screen.getByTestId('close-btn')).toBeInTheDocument();
  });

  it('shows the empty state when nothing is displayed', () => {
    renderFilter({ options: [] });

    expect(screen.getByText('No data found')).toBeInTheDocument();
  });

  it('renders selected values as chips on the chips input trigger', () => {
    renderFilter({
      isOpen: false,
      selectedValues: ['snowflake', 'bigquery'],
      triggerDisplay: 'chips',
      triggerVariant: 'input',
    });

    const chips = screen.getAllByTestId('filter-chip');
    expect(chips).toHaveLength(2);
    expect(chips[0]).toHaveTextContent('Snowflake');
    expect(chips[1]).toHaveTextContent('BigQuery');
  });

  it('removing a chip reports the remaining values', () => {
    const { onChange } = renderFilter({
      isOpen: false,
      selectedValues: ['snowflake', 'bigquery'],
      triggerDisplay: 'chips',
      triggerVariant: 'input',
    });

    const [removeSnowflake] = screen.getAllByRole('button', {
      name: 'Remove filter',
    });
    fireEvent.click(removeSnowflake);

    expect(onChange).toHaveBeenCalledWith(['bigquery']);
  });

  it('clear all empties the staged selection without committing', () => {
    const { onChange } = renderFilter({
      commitMode: 'staged',
      selectedValues: ['snowflake', 'bigquery'],
    });

    fireEvent.click(screen.getByTestId('clear-filter-btn'));

    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('update-btn'));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('formats row counts with locale separators', () => {
    renderFilter({
      options: [{ value: 'snowflake', label: 'Snowflake', count: 1204 }],
    });

    expect(screen.getByText('1,204')).toBeInTheDocument();
  });

  it('regular typography drops the medium weight on the trigger', () => {
    render(
      <FilterSelect
        data-testid="trigger-regular"
        label="Service"
        options={OPTIONS}
        selectedValues={[]}
        triggerVariant="button"
        typography="regular"
        onChange={() => undefined}
      />
    );

    expect(screen.getByTestId('trigger-regular').className).toContain(
      'font-normal'
    );
  });

  it('apply carries the staged count, and drops it when nothing is staged', () => {
    renderFilter({ commitMode: 'staged', selectedValues: ['snowflake'] });

    expect(screen.getByTestId('update-btn')).toHaveTextContent('Apply (1)');

    fireEvent.click(screen.getByTestId('clear-filter-btn'));

    expect(screen.getByTestId('update-btn')).toHaveTextContent('Apply');
    expect(screen.getByTestId('update-btn')).not.toHaveTextContent('(');
  });

  it('staged clear all is disabled until something is staged', () => {
    renderFilter({ commitMode: 'staged' });

    expect(screen.getByTestId('clear-filter-btn')).toBeDisabled();

    fireEvent.click(screen.getByText('Snowflake'));

    expect(screen.getByTestId('clear-filter-btn')).toBeEnabled();

    fireEvent.click(screen.getByTestId('clear-filter-btn'));

    expect(screen.getByTestId('clear-filter-btn')).toBeDisabled();
  });

  it('immediate mode footer reports the count and clears on demand', () => {
    const { onChange } = renderFilter({
      selectedValues: ['snowflake', 'bigquery'],
    });

    expect(screen.getByTestId('selected-count')).toHaveTextContent(
      '2 selected'
    );

    fireEvent.click(screen.getByTestId('clear-filter-btn'));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('immediate mode footer reports an empty selection', () => {
    renderFilter();

    expect(screen.getByTestId('selected-count')).toHaveTextContent(
      'None selected'
    );
    expect(screen.getByTestId('clear-filter-btn')).toBeDisabled();
  });

  it('single select has no footer', () => {
    renderFilter({ selectionMode: 'single', selectedValues: ['snowflake'] });

    expect(screen.queryByTestId('selected-count')).not.toBeInTheDocument();
    expect(screen.queryByTestId('clear-filter-btn')).not.toBeInTheDocument();
  });

  it('staged mode keeps the Apply footer, not the status footer', () => {
    renderFilter({ commitMode: 'staged', selectedValues: ['snowflake'] });

    expect(screen.queryByTestId('selected-count')).not.toBeInTheDocument();
    expect(screen.getByTestId('update-btn')).toBeInTheDocument();
  });

  it('removing a chip does not open the popover', () => {
    const { onChange } = renderFilter({
      isOpen: undefined,
      selectedValues: ['snowflake', 'bigquery'],
      triggerDisplay: 'chips',
      triggerVariant: 'input',
    });

    const [removeSnowflake] = screen.getAllByRole('button', {
      name: 'Remove filter',
    });
    fireEvent.click(removeSnowflake);

    expect(onChange).toHaveBeenCalledWith(['bigquery']);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('clicking the chips field trigger opens the popover', () => {
    renderFilter({
      isOpen: undefined,
      'data-testid': 'chips-trigger',
      selectedValues: ['snowflake'],
      triggerDisplay: 'chips',
      triggerVariant: 'input',
    });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('chips-trigger'));

    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('shows the placeholder on an empty input trigger', () => {
    renderFilter({
      isOpen: false,
      placeholder: 'Choose services',
      selectedValues: [],
      triggerVariant: 'input',
    });

    expect(screen.getByText('Choose services')).toBeInTheDocument();
  });
});
