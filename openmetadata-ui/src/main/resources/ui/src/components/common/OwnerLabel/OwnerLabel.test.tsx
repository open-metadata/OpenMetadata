/*
 *  Copyright 2023 Collate.
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
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OwnerLabel } from './OwnerLabel.component';

const mockOwner = [
  {
    id: 'id',
    type: 'user',
    name: 'Test Name',
  },
];
const mockTeamOwner = [
  {
    id: 'id',
    type: 'team',
    name: 'Team Name',
  },
];

jest.mock('@openmetadata/ui-core-components', () => ({
  Avatar: jest
    .fn()
    .mockImplementation(({ placeholder }) => <span>{placeholder}</span>),
  Divider: jest.fn().mockImplementation(() => <hr />),
  Typography: jest
    .fn()
    .mockImplementation(({ children, 'data-testid': testId }) => (
      <span data-testid={testId}>{children}</span>
    )),
  Button: jest
    .fn()
    .mockImplementation(({ children }) => <button>{children}</button>),
  Dropdown: {
    Root: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
    Popover: jest
      .fn()
      .mockImplementation(({ children }) => <div>{children}</div>),
    Menu: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
    Item: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
  },
}));

// Render the overflow tooltip open so its owner list can be asserted on.
jest.mock('react-aria-components', () => ({
  ...jest.requireActual('react-aria-components'),
  TooltipTrigger: jest
    .fn()
    .mockImplementation(({ children }) => <>{children}</>),
  Tooltip: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
}));

jest.mock('../ProfilePicture/ProfilePicture', () => {
  return jest.fn().mockReturnValue(<div>ProfilePicture.component</div>);
});
jest.mock('../UserTeamSelectableList/UserTeamSelectableList.component', () => {
  return {
    UserTeamSelectableList: jest
      .fn()
      .mockReturnValue(<div>UserTeamSelectableList.component</div>),
  };
});

jest.mock('../PopOverCard/UserPopOverCard', () =>
  jest.fn().mockImplementation(({ children }) => children)
);

describe('OwnerLabel component', () => {
  it('owner name with profile picture should render', async () => {
    render(<OwnerLabel owners={mockOwner} />, { wrapper: MemoryRouter });

    expect(
      await screen.findByText('ProfilePicture.component')
    ).toBeInTheDocument();
    expect(await screen.findByText(mockOwner[0].name)).toBeInTheDocument();
  });

  it('should render displayName if provided', async () => {
    render(
      <OwnerLabel
        owners={[{ id: 'id', type: 'user', displayName: 'displayName' }]}
      />,
      { wrapper: MemoryRouter }
    );

    expect(
      await screen.findByText('ProfilePicture.component')
    ).toBeInTheDocument();
    expect(await screen.findByText('displayName')).toBeInTheDocument();
  });

  it('should render ownerDisplayName if provided', async () => {
    const ownerDisplayNameMap = new Map<string, string>([
      [mockOwner[0].name, 'ownerDisplayName'],
    ]);
    render(
      <OwnerLabel ownerDisplayName={ownerDisplayNameMap} owners={mockOwner} />,
      { wrapper: MemoryRouter }
    );

    expect(
      await screen.findByText('ProfilePicture.component')
    ).toBeInTheDocument();
    expect(await screen.findByText('ownerDisplayName')).toBeInTheDocument();
    expect(screen.queryByText(mockOwner[0].name)).not.toBeInTheDocument();
  });

  it('should render no owner if owner is undefined', async () => {
    render(<OwnerLabel />, { wrapper: MemoryRouter });

    expect(await screen.findByText('label.no-entity')).toBeInTheDocument();
    expect(await screen.findByTestId('no-owner-icon')).toBeInTheDocument();
  });

  it('should render team icon and team name if owner is team', async () => {
    render(<OwnerLabel owners={mockTeamOwner} />, { wrapper: MemoryRouter });

    expect(
      await screen.findByTestId(`${mockTeamOwner[0].name}`)
    ).toBeInTheDocument();
  });

  it('should render UserTeamSelectableList if onUpdate function is provided', async () => {
    render(<OwnerLabel owners={mockTeamOwner} onUpdate={jest.fn()} />, {
      wrapper: MemoryRouter,
    });

    expect(
      await screen.findByText('UserTeamSelectableList.component')
    ).toBeInTheDocument();
  });

  it('should mark inherited owners in the non-compact view', async () => {
    render(
      <OwnerLabel
        isCompactView={false}
        owners={[
          { ...mockOwner[0], inherited: true },
          { ...mockTeamOwner[0], id: 'team-id', inherited: true },
          { id: 'direct-id', type: 'user', name: 'Direct Owner' },
        ]}
      />,
      { wrapper: MemoryRouter }
    );

    expect(await screen.findAllByTestId('inherited-owner-icon')).toHaveLength(
      2
    );
  });

  it('should not mark a directly assigned owner in the non-compact view', async () => {
    render(<OwnerLabel isCompactView={false} owners={mockOwner} />, {
      wrapper: MemoryRouter,
    });

    expect(await screen.findByText(mockOwner[0].name)).toBeInTheDocument();
    expect(
      screen.queryByTestId('inherited-owner-icon')
    ).not.toBeInTheDocument();
  });

  it('should mark an inherited team owner in the compact view', async () => {
    render(<OwnerLabel owners={[{ ...mockTeamOwner[0], inherited: true }]} />, {
      wrapper: MemoryRouter,
    });

    expect(
      await screen.findByTestId('inherited-owner-icon')
    ).toBeInTheDocument();
  });

  it('should mark and name a single inherited owner in the non-compact view', async () => {
    render(
      <OwnerLabel
        isCompactView={false}
        owners={[{ ...mockOwner[0], inherited: true }]}
      />,
      { wrapper: MemoryRouter }
    );

    expect(
      await screen.findByTestId('inherited-owner-icon')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: `${mockOwner[0].name}, label.inherited-entity`,
      })
    ).toBeInTheDocument();
  });

  it('should mark inherited owners in the non-compact overflow popover', async () => {
    render(
      <OwnerLabel
        isCompactView={false}
        maxVisibleOwners={1}
        owners={[
          { ...mockOwner[0], inherited: true },
          { id: 'second-id', type: 'user', name: 'Second', inherited: true },
        ]}
      />,
      { wrapper: MemoryRouter }
    );

    const popover = await screen.findByTestId('owners-overflow-popover');

    expect(
      popover.querySelectorAll('[data-testid="inherited-owner-icon"]')
    ).toHaveLength(2);
  });
});
