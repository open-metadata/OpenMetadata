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
import { PersonalSpacePanel } from '../../../../hooks/usePersonalSpaceStore';
import React, { ReactNode } from 'react';
import { MemoryRouter, useNavigate } from 'react-router-dom';

const mockClose = jest.fn();
let mockActivePanel: PersonalSpacePanel | null;

jest.mock('../../../../hooks/usePersonalSpaceStore', () => ({
  usePersonalSpaceStore: (
    selector: (state: {
      activePanel: PersonalSpacePanel | null;
      close: () => void;
    }) => unknown
  ) => selector({ activePanel: mockActivePanel, close: mockClose }),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  ModalOverlay: ({
    isOpen,
    onOpenChange,
    children,
  }: {
    isOpen?: boolean;
    onOpenChange: (...args: unknown[]) => void;
    children?: ReactNode;
  }) =>
    isOpen ? (
      <div data-testid="overlay">
        <button
          aria-label="overlay-dismiss"
          data-testid="overlay-dismiss"
          type="button"
          onClick={() => onOpenChange(false)}
        />
        {children}
      </div>
    ) : null,
  Modal: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Dialog: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

jest.mock('../PersonalSpaceGate/PersonalSpaceGate', () => ({
  __esModule: true,
  default: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

jest.mock('../Profile/ProfilePage', () => ({
  __esModule: true,
  default: () => <div data-testid="profile-page" />,
}));

import PersonalSpaceModal from './PersonalSpaceModal';

const NavButton: React.FC = () => {
  const navigate = useNavigate();

  return (
    <button
      aria-label="navigate"
      data-testid="navigate"
      type="button"
      onClick={() => navigate('/settings/members/teams/Organization')}
    />
  );
};

const renderInRouter = () =>
  render(
    <MemoryRouter initialEntries={['/ai']}>
      <PersonalSpaceModal />
      <NavButton />
    </MemoryRouter>
  );

describe('PersonalSpaceModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActivePanel = null;
  });

  it('renders nothing when no panel is active', () => {
    renderInRouter();

    expect(screen.queryByTestId('overlay')).not.toBeInTheDocument();
  });

  it('renders the Profile page when the profile panel is active', () => {
    mockActivePanel = 'profile';
    renderInRouter();

    expect(screen.getByTestId('profile-page')).toBeInTheDocument();
  });

  it('closes when the overlay is dismissed', () => {
    mockActivePanel = 'profile';
    renderInRouter();

    fireEvent.click(screen.getByTestId('overlay-dismiss'));

    expect(mockClose).toHaveBeenCalled();
  });

  it('does not close on initial mount', () => {
    mockActivePanel = 'profile';
    renderInRouter();

    expect(mockClose).not.toHaveBeenCalled();
  });

  it('closes when the route changes while open (in-modal link navigation)', () => {
    mockActivePanel = 'profile';
    renderInRouter();

    fireEvent.click(screen.getByTestId('navigate'));

    expect(mockClose).toHaveBeenCalled();
  });
});
