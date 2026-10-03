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
import { DomainMismatchAlert } from './DomainMismatchAlert.component';

const mockSwitch = jest.fn();
let mockActiveDomain = 'Sales';

jest.mock('../../../hooks/useDomainStore', () => ({
  useDomainStore: () => ({ activeDomain: mockActiveDomain }),
}));

jest.mock('../../../hooks/useSwitchActiveDomain', () => ({
  useSwitchActiveDomain: () => mockSwitch,
}));

const marketing = {
  id: 'm1',
  type: 'domain',
  name: 'Marketing',
  fullyQualifiedName: 'Marketing',
};

describe('DomainMismatchAlert', () => {
  beforeEach(() => {
    mockActiveDomain = 'Sales';
    mockSwitch.mockReset();
    localStorage.clear();
  });

  it('shows for an entity outside the selected domain and switches to its domain', () => {
    render(<DomainMismatchAlert domains={[marketing]} entityId="e1" />);

    expect(screen.getByTestId('domain-mismatch-alert')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('domain-mismatch-switch'));

    expect(mockSwitch).toHaveBeenCalledWith(marketing);
  });

  it('stays hidden for an entity inside the selected domain', () => {
    mockActiveDomain = 'Marketing';
    render(<DomainMismatchAlert domains={[marketing]} entityId="e1" />);

    expect(screen.queryByTestId('domain-mismatch-alert')).toBeNull();
  });

  it('stays hidden once dismissed for that entity', () => {
    const { unmount } = render(
      <DomainMismatchAlert domains={[marketing]} entityId="e1" />
    );
    fireEvent.click(screen.getByRole('button', { name: /close/i }));

    expect(screen.queryByTestId('domain-mismatch-alert')).toBeNull();

    unmount();
    render(<DomainMismatchAlert domains={[marketing]} entityId="e1" />);

    expect(screen.queryByTestId('domain-mismatch-alert')).toBeNull();
  });
});
