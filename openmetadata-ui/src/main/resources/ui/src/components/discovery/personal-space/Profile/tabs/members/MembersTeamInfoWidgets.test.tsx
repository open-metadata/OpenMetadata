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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MASKED_PASSWORD_VALUE } from '../../../../../../constants/Secrets.constants';
import { Team, TeamType } from '../../../../../../generated/entity/teams/team';
import MembersTeamInfoWidgets from './MembersTeamInfoWidgets';

let mockIsAdminUser = true;

jest.mock('../../../../../../hooks/authHooks', () => ({
  useAuth: () => ({ isAdminUser: mockIsAdminUser }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}${JSON.stringify(params)}` : key,
  }),
}));

// The field editors are overlay widgets with their own suites; stub them so this
// test focuses on which widgets the container composes per team type.
jest.mock('../../../../../common/DomainSelect/DomainSelect', () => ({
  __esModule: true,
  default: () => <div data-testid="domain-select" />,
}));
jest.mock('../../../../../common/DomainSelect/DomainSelectTrigger', () => ({
  DomainSelectTrigger: () => <div data-testid="domain-select-trigger" />,
}));
jest.mock('../../../../../common/DomainTags/DomainTags', () => ({
  __esModule: true,
  default: () => <div data-testid="domain-tags" />,
}));
jest.mock('../../../../../common/PersonaSelect/PersonaSelect', () => ({
  __esModule: true,
  default: () => <div data-testid="persona-select" />,
}));
jest.mock(
  '../../../../../common/UserTeamSelectableList/UserTeamSelectableList.component',
  () => ({ UserTeamSelectableList: () => <div data-testid="owner-select" /> })
);

const groupTeam = {
  name: 'eng',
  fullyQualifiedName: 'eng',
  displayName: 'Engineering',
  teamType: TeamType.Group,
  userCount: 5,
} as Team;

describe('MembersTeamInfoWidgets', () => {
  beforeEach(() => {
    mockIsAdminUser = true;
  });

  it('renders the widget strip with the distinct user count', () => {
    render(
      <MembersTeamInfoWidgets canEdit team={groupTeam} onPatch={jest.fn()} />
    );

    expect(screen.getByTestId('team-info-widgets')).toBeInTheDocument();
    expect(screen.getByTestId('team-user-count')).toHaveTextContent('5');
  });

  it('shows the team type and persona widgets for a non-organization team', () => {
    render(
      <MembersTeamInfoWidgets canEdit team={groupTeam} onPatch={jest.fn()} />
    );

    expect(screen.getByTestId('team-type')).toBeInTheDocument();
    expect(screen.getByTestId('team-persona')).toBeInTheDocument();
  });

  it('hides the team type and persona widgets for the Organization root', () => {
    render(
      <MembersTeamInfoWidgets
        canEdit
        team={{ ...groupTeam, teamType: TeamType.Organization } as Team}
        onPatch={jest.fn()}
      />
    );

    expect(screen.queryByTestId('team-type')).not.toBeInTheDocument();
    expect(screen.queryByTestId('team-persona')).not.toBeInTheDocument();
  });

  it('saves a masked endpoint unchanged and keeps the rest of the profile', async () => {
    const onPatch = jest.fn().mockResolvedValue(true);
    const images = { image: 'https://example.com/team.png' };
    render(
      <MembersTeamInfoWidgets
        canEdit
        team={
          {
            ...groupTeam,
            profile: {
              images,
              subscription: { slack: { endpoint: MASKED_PASSWORD_VALUE } },
            },
          } as Team
        }
        onPatch={onPatch}
      />
    );

    expect(screen.getByTestId('subscription-value')).toHaveTextContent(
      'label.slack'
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-subscription'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-subscription'));
    });

    expect(onPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        profile: {
          images,
          subscription: { slack: { endpoint: MASKED_PASSWORD_VALUE } },
        },
      })
    );
  });

  it('asks for an endpoint in words when it is left empty', async () => {
    const onPatch = jest.fn();
    render(
      <MembersTeamInfoWidgets
        canEdit
        team={
          {
            ...groupTeam,
            profile: {
              subscription: { slack: { endpoint: MASKED_PASSWORD_VALUE } },
            },
          } as Team
        }
        onPatch={onPatch}
      />
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-subscription'));
    });
    const endpoint = screen
      .getByTestId('subscription-endpoint-input')
      .querySelector('input') as HTMLInputElement;
    fireEvent.change(endpoint, { target: { value: '' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-subscription'));
    });

    expect(
      screen.getByText(
        'message.field-text-is-required{"fieldText":"label.endpoint"}'
      )
    ).toBeInTheDocument();
    expect(onPatch).not.toHaveBeenCalled();
  });

  it('hides the edit affordances when the user cannot edit', () => {
    render(
      <MembersTeamInfoWidgets
        canEdit={false}
        team={groupTeam}
        onPatch={jest.fn()}
      />
    );

    expect(screen.queryByTestId('edit-domain')).not.toBeInTheDocument();
    expect(screen.queryByTestId('edit-email')).not.toBeInTheDocument();
  });

  it('lets an admin set the default persona', () => {
    render(
      <MembersTeamInfoWidgets canEdit team={groupTeam} onPatch={jest.fn()} />
    );

    expect(screen.getByTestId('persona-select')).toBeInTheDocument();
  });

  it('keeps the default persona read-only for a non-admin who may edit the team', () => {
    mockIsAdminUser = false;

    render(
      <MembersTeamInfoWidgets canEdit team={groupTeam} onPatch={jest.fn()} />
    );

    expect(screen.getByTestId('team-persona')).toBeInTheDocument();
    expect(screen.queryByTestId('persona-select')).not.toBeInTheDocument();
    expect(screen.getByTestId('domain-select')).toBeInTheDocument();
  });
});
