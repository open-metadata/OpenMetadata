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
import { DomainFilterChip } from './DomainFilterChip.component';

const mockSwitch = jest.fn();
let mockActiveDomain = 'Sales';

jest.mock('../../../hooks/useDomainStore', () => ({
  useDomainStore: () => ({
    activeDomain: mockActiveDomain,
    activeDomainEntityRef: {
      id: 's1',
      type: 'domain',
      name: mockActiveDomain,
    },
  }),
}));

jest.mock('../../../hooks/useSwitchActiveDomain', () => ({
  useSwitchActiveDomain: () => mockSwitch,
}));

describe('DomainFilterChip', () => {
  beforeEach(() => {
    mockActiveDomain = 'Sales';
    mockSwitch.mockReset();
  });

  it('names the selected domain and clears it', () => {
    render(<DomainFilterChip />);

    expect(screen.getByTestId('domain-filter-chip')).toHaveTextContent('Sales');

    fireEvent.click(screen.getByTestId('domain-filter-chip-clear'));

    expect(mockSwitch).toHaveBeenCalledWith(undefined);
  });

  it('renders nothing when all domains are shown', () => {
    mockActiveDomain = 'All Domains';
    render(<DomainFilterChip />);

    expect(screen.queryByTestId('domain-filter-chip')).toBeNull();
  });
});
