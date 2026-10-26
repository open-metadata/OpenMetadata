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
import MyDataPage from './MyData';

const mockCurrentUser = { id: 'u1', name: 'alice' };

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: mockCurrentUser }),
}));

jest.mock('../UserAssets/UserAssetsView', () => ({
  __esModule: true,
  default: ({ kind, user }: { kind: string; user: { id: string } }) => (
    <div data-testid="user-assets-view">{`${kind}:${user.id}`}</div>
  ),
}));

describe('MyDataPage', () => {
  it('shows the current user owned assets on the My Data tab by default', () => {
    render(<MyDataPage />);

    expect(screen.getByRole('tab', { name: 'label.my-data' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByTestId('user-assets-view')).toHaveTextContent(
      'owned:u1'
    );
  });

  it('switches to the followed assets on the Following tab', () => {
    render(<MyDataPage />);

    fireEvent.click(screen.getByRole('tab', { name: 'label.following' }));

    expect(
      screen.getByRole('tab', { name: 'label.following' })
    ).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('user-assets-view')).toHaveTextContent(
      'following:u1'
    );
  });
});
