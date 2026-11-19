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

const mockSelect = jest.fn();

// The control itself belongs to core; what this wrapper owns is how the
// options and the selection are handed to it.
jest.mock('@openmetadata/ui-core-components', () => {
  const Select = (props: Record<string, unknown>) => {
    mockSelect(props);

    return <div data-testid={props['data-testid'] as string} />;
  };
  Select.Item = () => null;

  return { Select };
});

const OPTIONS = [
  { label: 'Alpha', value: 'a' },
  { label: 'Beta', value: 'b' },
];

const lastProps = () =>
  mockSelect.mock.calls[mockSelect.mock.calls.length - 1][0];

describe('FilterButton', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the xs core Select with the options in their own order', () => {
    render(
      <FilterButton
        label="Range"
        options={OPTIONS}
        testId="range-filter"
        value="b"
        onChange={jest.fn()}
      />
    );

    expect(lastProps().size).toBe('xs');
    expect(lastProps().selectedKey).toBe('b');
    expect(lastProps()['aria-label']).toBe('Range');
    expect(lastProps().items).toEqual([
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
    ]);
  });

  it('hands the chosen option back as its value', () => {
    const onChange = jest.fn();
    render(
      <FilterButton
        label="Range"
        options={OPTIONS}
        value="a"
        onChange={onChange}
      />
    );

    lastProps().onSelectionChange('b');

    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('ignores a cleared selection, since every card filter holds a value', () => {
    const onChange = jest.fn();
    render(
      <FilterButton
        label="Range"
        options={OPTIONS}
        value="a"
        onChange={onChange}
      />
    );

    lastProps().onSelectionChange(null);

    expect(onChange).not.toHaveBeenCalled();
  });
});
