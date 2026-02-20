/*
 *  Copyright 2024 Collate.
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
import { BrowserRouter } from 'react-router-dom';
import { User } from '../../../../generated/entity/teams/user';
import { EntityReference } from '../../../../generated/entity/type';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { UserProfileIcon } from './UserProfileIcon.component';

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(),
}));
jest.mock('../../../../hooks/authHooks', () => ({
  useAuthProvider: () => ({
    onLogoutHandler: jest.fn(),
  }),
}));
const translationState = {
  language: 'en',
};

const germanTranslations: Record<string, string> = {
  'label.role-plural': 'Rollen',
  'label.team-plural': 'Teams',
  'label.logout': 'Abmelden',
  'label.switch-persona': 'Persona wechseln',
  'label.inherited-role-plural': 'Geerbte Rollen',
  'label.default': 'Standard',
  'label.more': 'mehr',
};

const mockChangeLanguage = jest.fn((lng: string) => {
  translationState.language = lng;
});

const mockI18n = {
  changeLanguage: mockChangeLanguage,
  language: translationState.language,
};

jest.mock('react-i18next', () => ({
  useTranslation: () => {
    const currentLanguage = translationState.language;
    const getTranslation = (key: string) => {
      if (currentLanguage === 'de') {
        return germanTranslations[key] || key;
      }

      return key;
    };

    return {
      t: getTranslation,
      i18n: mockI18n,
    };
  },
}));

const mockPersonas: EntityReference[] = [
  {
    id: 'persona-1',
    name: 'default-persona',
    displayName: 'Default Persona',
    type: 'persona',
  },
  {
    id: 'persona-2',
    name: 'selected-persona',
    displayName: 'Selected Persona',
    type: 'persona',
  },
  {
    id: 'persona-3',
    name: 'alpha-persona',
    displayName: 'Alpha Persona',
    type: 'persona',
  },
];

const mockUser: User = {
  id: 'user-1',
  name: 'test-user',
  displayName: 'Test User',
  email: 'test@example.com',
  isAdmin: false,
  defaultPersona: mockPersonas[0],
  personas: mockPersonas,
  roles: [],
  teams: [],
  inheritedRoles: [],
};

const createMockStoreData = (overrides = {}) => ({
  currentUser: mockUser,
  selectedPersona: mockPersonas[1],
  setSelectedPersona: jest.fn(),
  userProfilePics: {
    'test-user': {
      ...mockUser,
      profile: {
        images: {
          image: 'https://example.com/profile.jpg',
          image192: 'https://example.com/profile-192.jpg',
        },
      },
    } as User,
  },
  updateUserProfilePics: jest.fn(),
  ...overrides,
});

const MockWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('UserProfileIcon', () => {
  const mockUseApplicationStore = useApplicationStore as unknown as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseApplicationStore.mockReturnValue(createMockStoreData());
    translationState.language = 'en';
  });

  const openDropdown = () => {
    const userButton = screen.getByRole('button');
    fireEvent.click(userButton);

    return userButton;
  };

  const expandPersonas = () => {
    const moreButton = screen.getByText('1 label.more');
    fireEvent.click(moreButton);
  };

  it('should render user profile dropdown', () => {
    render(
      <MockWrapper>
        <UserProfileIcon />
      </MockWrapper>
    );

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should display personas with pagination and sorting', async () => {
    render(
      <MockWrapper>
        <UserProfileIcon />
      </MockWrapper>
    );

    openDropdown();
    await screen.findByText('label.switch-persona');

    // Initially shows 2 personas (pagination)
    let personaLabels = screen.getAllByTestId('persona-label');

    expect(personaLabels).toHaveLength(2);

    // Default persona should be first
    expect(personaLabels[0].textContent).toContain('Default Persona');
    expect(screen.getByTestId('default-persona-tag')).toBeInTheDocument();

    // Expand to show all personas
    expandPersonas();
    personaLabels = screen.getAllByTestId('persona-label');

    expect(personaLabels).toHaveLength(3);
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('should handle persona selection', async () => {
    const mockSetSelectedPersona = jest.fn();
    mockUseApplicationStore.mockReturnValue(
      createMockStoreData({ setSelectedPersona: mockSetSelectedPersona })
    );

    render(
      <MockWrapper>
        <UserProfileIcon />
      </MockWrapper>
    );

    openDropdown();
    await screen.findByText('label.switch-persona');
    expandPersonas();

    const alphaPersonaLabel = screen
      .getAllByTestId('persona-label')
      .find((label) =>
        label.textContent?.includes('Alpha Persona')
      ) as HTMLElement;

    fireEvent.click(alphaPersonaLabel);

    expect(mockSetSelectedPersona).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'persona-3',
        name: 'alpha-persona',
      })
    );
  });

  it('should handle missing default persona', () => {
    mockUseApplicationStore.mockReturnValue(
      createMockStoreData({
        currentUser: { ...mockUser, defaultPersona: undefined },
      })
    );

    render(
      <MockWrapper>
        <UserProfileIcon />
      </MockWrapper>
    );

    openDropdown();

    expect(screen.queryByTestId('default-persona-tag')).not.toBeInTheDocument();
    expect(screen.getAllByRole('radio').length).toBeGreaterThan(0);
  });

  it('should update dropdown labels when language changes', async () => {
    const { rerender } = render(
      <MockWrapper>
        <UserProfileIcon />
      </MockWrapper>
    );

    openDropdown();
    await screen.findByText('label.switch-persona');

    expect(screen.getByText('label.role-plural')).toBeInTheDocument();
    expect(screen.getByText('label.team-plural')).toBeInTheDocument();
    expect(screen.getByText('label.logout')).toBeInTheDocument();

    mockChangeLanguage('de');
    rerender(
      <MockWrapper>
        <UserProfileIcon />
      </MockWrapper>
    );

    expect(screen.getByText('Persona wechseln')).toBeInTheDocument();
    expect(screen.getByText('Rollen')).toBeInTheDocument();
    expect(screen.getByText('Teams')).toBeInTheDocument();
    expect(screen.getByText('Abmelden')).toBeInTheDocument();
  });
});
