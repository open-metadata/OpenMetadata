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
import { render } from '@testing-library/react';
import FilterButton from './FilterButton';

const mockFilterSelect = jest.fn();

// The control itself belongs to core; what this wrapper owns is how the
// options and the selection are handed to it.
jest.mock('@openmetadata/ui-core-components', () => ({
  FilterSelect: (props: Record<string, unknown>) => {
    mockFilterSelect(props);

    return <div data-testid={props['data-testid'] as string} />;
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const OPTIONS = [
  { label: 'Alpha', value: 'a' },
  { label: 'Beta', value: 'b' },
  { label: 'Gamma', value: 'c' },
];

const lastProps = () =>
  mockFilterSelect.mock.calls[mockFilterSelect.mock.calls.length - 1][0];

describe('FilterButton', () => {
  beforeEach(() => jest.clearAllMocks());

  it('puts the selected option first, keeping the rest in order', () => {
    render(<FilterButton options={OPTIONS} value="c" onChange={jest.fn()} />);

    expect(
      lastProps().options.map((option: { value: string }) => option.value)
    ).toEqual(['c', 'a', 'b']);
    expect(lastProps().selectedValues).toEqual(['c']);
    expect(lastProps().selectionMode).toBe('single');
  });

  it('hands a single selection back as a value, not an array', () => {
    const onChange = jest.fn();
    render(<FilterButton options={OPTIONS} value="a" onChange={onChange} />);

    lastProps().onChange(['b']);

    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('hands a multiple selection back as the array', () => {
    const onChange = jest.fn();
    render(
      <FilterButton multiple options={OPTIONS} value={[]} onChange={onChange} />
    );

    lastProps().onChange(['a', 'c']);

    expect(onChange).toHaveBeenCalledWith(['a', 'c']);
    expect(lastProps().selectionMode).toBe('multiple');
  });

  it('names the empty state after the list when told what it holds', () => {
    render(
      <FilterButton
        emptyLabel="Owners"
        options={[]}
        testId="owner-filter"
        value=""
        onChange={jest.fn()}
      />
    );

    expect(lastProps().emptyState).toBe('label.no-entity');
    expect(lastProps()['data-testid']).toBe('owner-filter');
  });
});
