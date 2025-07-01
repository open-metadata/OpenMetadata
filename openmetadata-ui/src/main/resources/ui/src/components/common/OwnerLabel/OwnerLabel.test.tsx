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
    render(
      <OwnerLabel ownerDisplayName={['ownerDisplayName']} owners={mockOwner} />,
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
});
