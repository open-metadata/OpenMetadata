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

import { render, screen, within } from '@testing-library/react';
import { EntityReference, User } from '../../../../generated/entity/teams/user';
import UserProfilePersonas from './UserProfilePersona.component';

const DATA_SEEKER: EntityReference = {
  id: 'persona-1',
  type: 'persona',
  name: 'Data Seeker',
  displayName: 'Data Seeker',
};

jest.mock('../../../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({ isAdminUser: true }),
}));

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest
    .fn()
    .mockReturnValue({ currentUser: { name: 'admin' } }),
}));

jest.mock('../../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'test-user' }),
}));

jest.mock(
  '../../../MyData/Persona/PersonaSelectableList/PersonaSelectableList.component',
  () => ({
    PersonaSelectableList: jest
      .fn()
      .mockReturnValue(<div>PersonaSelectableList</div>),
  })
);

jest.mock('../../../common/Chip/Chip.component', () =>
  jest.fn(({ data, noDataPlaceholder }) => (
    <div>
      {data.length
        ? data.map((item: EntityReference) => item.displayName).join(',')
        : noDataPlaceholder}
    </div>
  ))
);

const mockProps = {
  updateUserDetails: jest.fn(),
};

const renderComponent = (userData: Partial<User>) =>
  render(<UserProfilePersonas {...mockProps} userData={userData as User} />);

describe('UserProfilePersonas', () => {
  it('should not show an inherited team persona as the default persona', () => {
    const { container } = renderComponent({
      personas: [],
      inheritedPersonas: [DATA_SEEKER],
      defaultPersona: undefined,
    });

    const defaultChip = screen.getByTestId('default-persona-chip');

    expect(
      within(defaultChip).getByText('message.no-default-persona')
    ).toBeInTheDocument();
    expect(within(defaultChip).queryByText('Data Seeker')).toBeNull();
    expect(container.querySelector('.inherit-icon')).toBeNull();
  });

  it('should show the explicitly selected default persona', () => {
    const defaultChip = renderComponent({
      personas: [],
      inheritedPersonas: [],
      defaultPersona: DATA_SEEKER,
    });

    expect(
      within(defaultChip.getByTestId('default-persona-chip')).getByText(
        'Data Seeker'
      )
    ).toBeInTheDocument();
  });
});
