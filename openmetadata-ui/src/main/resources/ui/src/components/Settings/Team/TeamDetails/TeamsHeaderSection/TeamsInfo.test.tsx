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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { compare } from 'fast-json-patch';
import { Operation } from '../../../../../generated/entity/policies/policy';
import { Team, TeamType } from '../../../../../generated/entity/teams/team';
import { ENTITY_PERMISSIONS } from '../../../../../mocks/Permissions.mock';
import TeamsInfo from './TeamsInfo.component';

const mockTeam = {
  changeDescription: {},
  children: [],
  childrenCount: 0,
  defaultRoles: [],
  deleted: false,
  description: 'Test team description',
  displayName: 'Test Team',
  domain: { id: 'test-domain', type: 'domain' },
  email: 'test-team@test.com',
  fullyQualifiedName: 'test-team',
  href: '/test-team',
  id: 'test-team',
  inheritedRoles: [],
  isJoinable: true,
  name: 'test-team',
  owner: { id: 'test-user', type: 'user' },
  owns: [],
  parents: [],
  policies: [],
  profile: {},
  teamType: TeamType.Organization,
  updatedAt: Date.now(),
  updatedBy: 'test-user',
  userCount: 1,
  users: [{ id: 'test-user', type: 'user' }],
  version: 1,
};

// Team that has a stored avatar under `profile.images` (populated out-of-band via
// the REST API). This is the precondition that makes the subscription-webhook bug
// destructive: `profile.images` is present in the stored team, so a `profile`
// rebuild that drops it produces a `remove /profile/images` JSON-Patch op that
// `TeamsPage.updateTeamHandler` sends to `PATCH /teams/{id}`.
const teamWithStoredImages: Team = {
  ...mockTeam,
  profile: {
    images: {
      image: 'https://cdn.example.com/avatar.png',
      image72: 'https://cdn.example.com/avatar72.png',
    },
    subscription: {
      slack: { endpoint: 'https://hooks.slack.com/services/old' },
    },
  },
};

jest.mock('@openmetadata/ui-core-components', () => ({
  ...jest.requireActual('@openmetadata/ui-core-components'),
  Owner: jest.fn().mockReturnValue(null),
}));

jest.mock('../../../../common/DomainLabel/DomainLabel.component', () => ({
  DomainLabel: jest.fn().mockImplementation(() => <div>DomainLabel</div>),
}));

// NOTE: `TeamsSubscription` is deliberately NOT mocked here. The
// `updateTeamSubscription` data-loss bug lives in how `TeamsInfo` builds the
// `Team` payload it hands to `updateTeamHandler`, and `TeamsSubscription` is
// the only caller of that handler. Mocking it (as this file previously did)
// makes the handler unreachable; mocking a default export with a factory also
// never commits the stub to the test DOM under this project's ts-jest ESM
// config, so the handler can't be captured. Rendering the real component lets
// us drive `onFinish` the way a user would (open the edit modal, submit the
// form) and then assert on the `updateTeamHandler` payload + the
// `fast-json-patch.compare` diff that `TeamsPage.updateTeamHandler` produces.

jest.mock('../../../../common/TeamTypeSelect/TeamTypeSelect.component', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => <div>TeamTypeSelect</div>),
}));

jest.mock('../../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({
    currentUser: { id: 'test-user' },
  }),
}));

jest.mock(
  '../../../../../context/RuleEnforcementProvider/RuleEnforcementProvider',
  () => ({
    useRuleEnforcementProvider: jest.fn().mockImplementation(() => ({
      fetchRulesForEntity: jest.fn(),
      getRulesForEntity: jest.fn(),
      getEntityRuleValidation: jest.fn(),
    })),
  })
);

jest.mock('../../../../../hooks/useEntityRules', () => ({
  useEntityRules: jest.fn().mockImplementation(() => ({
    entityRules: {
      canAddMultipleUserOwners: true,
      canAddMultipleTeamOwner: true,
    },
  })),
}));

const mockEntityPermissions = { ...ENTITY_PERMISSIONS };

const mockUpdateTeamHandler = jest.fn();
const teamProps = {
  parentTeams: [],
  isGroupType: false,
  childTeamsCount: 0,
  currentTeam: mockTeam,
  entityPermissions: mockEntityPermissions,
  isTeamDeleted: false,
  updateTeamHandler: mockUpdateTeamHandler,
};

describe('TeamsInfo', () => {
  it('should render TeamsInfo', async () => {
    await act(async () => {
      render(<TeamsInfo {...teamProps} />);
    });
    const domainLabel = screen.getByText('DomainLabel');
    const userCount = screen.getByTestId('team-user-count');

    expect(domainLabel).toBeInTheDocument();
    expect(userCount).toContainHTML('1');
  });

  it('should handle edit team email', () => {
    const { getByTestId } = render(<TeamsInfo {...teamProps} />);
    const editButton = getByTestId('edit-email');
    fireEvent.click(editButton);
    const teamEmailInput = getByTestId('email-input');

    expect(teamEmailInput).toBeInTheDocument();
  });

  it('should handle save team email', async () => {
    const { getByTestId } = render(<TeamsInfo {...teamProps} />);
    const editButton = getByTestId('edit-email');
    fireEvent.click(editButton);
    const saveButton = getByTestId('save-edit-email');
    await act(async () => {
      fireEvent.click(saveButton);
    });

    expect(mockUpdateTeamHandler).toHaveBeenCalled();
  });

  it('should handle cancel team email edit', async () => {
    const { getByTestId } = render(<TeamsInfo {...teamProps} />);
    const editButton = getByTestId('edit-email');
    fireEvent.click(editButton);
    const cancelButton = getByTestId('cancel-edit-email');
    await act(async () => {
      fireEvent.click(cancelButton);
    });

    expect(screen.queryByTestId('email-input')).not.toBeInTheDocument();
  });

  it('should not render edit button if team type is organization', () => {
    const { queryByTestId } = render(<TeamsInfo {...teamProps} />);

    expect(queryByTestId('edit-team-type-icon')).not.toBeInTheDocument();
  });

  it('should not render edit button if team type is group & isGroupType is true', () => {
    const { queryByTestId } = render(
      <TeamsInfo
        {...teamProps}
        isGroupType
        currentTeam={{ ...mockTeam, teamType: TeamType.Group }}
      />
    );

    expect(queryByTestId('edit-team-type-icon')).not.toBeInTheDocument();
  });

  it('should render edit button if team type is not group and organization', () => {
    const { queryByTestId } = render(
      <TeamsInfo
        {...teamProps}
        currentTeam={{ ...mockTeam, teamType: TeamType.BusinessUnit }}
      />
    );

    expect(queryByTestId('edit-team-type-icon')).toBeInTheDocument();
  });

  it('should not show edit button if user does not have permission', () => {
    mockEntityPermissions[Operation.EditAll] = false;
    const { queryByTestId } = render(<TeamsInfo {...teamProps} />);
    const ownerLabel = queryByTestId('edit-email');

    expect(ownerLabel).not.toBeInTheDocument();
  });

  // The `TeamsSubscription` child drives `updateTeamSubscription`. These tests
  // render the REAL `TeamsSubscription` (see the NOTE above the mock block),
  // open its edit modal, and submit the form the way a user would, then assert
  // on the `Team` payload handed to `updateTeamHandler`. `TeamsPage.updateTeamHandler`
  // diffs that payload against the stored team with `fast-json-patch.compare`
  // and PATCHes the backend, so we also assert on the `compare` output to prove
  // no destructive `remove /profile/images` op is generated.
  describe('updateTeamSubscription profile.images preservation', () => {
    // An earlier test mutates `mockEntityPermissions[Operation.EditAll]` to false
    // without restoring it; the edit-subscription button only renders with edit
    // permission, so reset it here for order independence.
    beforeEach(() => {
      mockEntityPermissions[Operation.EditAll] = true;
    });

    const submitSubscriptionForm = async (
      currentTeam: Team,
      { changeEndpointTo }: { changeEndpointTo?: string } = {}
    ) => {
      const utils = render(
        <TeamsInfo {...teamProps} currentTeam={currentTeam} />
      );

      await act(async () => {
        fireEvent.click(utils.getByTestId('edit-team-subscription'));
      });

      if (changeEndpointTo !== undefined) {
        const endpointInput = utils.getByPlaceholderText(
          'label.enter-entity-value'
        ) as HTMLInputElement;
        await act(async () => {
          fireEvent.change(endpointInput, {
            target: { value: changeEndpointTo },
          });
        });
      }

      await act(async () => {
        fireEvent.click(utils.getByText('label.confirm'));
      });

      return mockUpdateTeamHandler.mock.calls[
        mockUpdateTeamHandler.mock.calls.length - 1
      ][0] as Team;
    };

    it('should preserve profile.images when setting a new subscription webhook for a team with stored images', async () => {
      const updatedData = await submitSubscriptionForm(teamWithStoredImages, {
        changeEndpointTo: 'https://hooks.slack.com/services/new',
      });

      expect(mockUpdateTeamHandler).toHaveBeenCalledTimes(1);
      // `profile.images` must be carried through unchanged.
      expect(updatedData.profile?.images).toEqual({
        image: 'https://cdn.example.com/avatar.png',
        image72: 'https://cdn.example.com/avatar72.png',
      });
      // The subscription endpoint change must still propagate.
      expect(updatedData.profile?.subscription).toEqual({
        slack: { endpoint: 'https://hooks.slack.com/services/new' },
      });

      // The JSON-Patch `TeamsPage.updateTeamHandler` would send must touch only
      // the subscription subtree — never `/profile/images`.
      const jsonPatch = compare(teamWithStoredImages, updatedData);
      const imagesOps = jsonPatch.filter((op) =>
        op.path.startsWith('/profile/images')
      );
      const subscriptionOps = jsonPatch.filter((op) =>
        op.path.startsWith('/profile/subscription')
      );

      expect(imagesOps).toEqual([]);
      expect(subscriptionOps.length).toBeGreaterThan(0);
    });

    it('should not emit a destructive remove /profile/images op when clearing the subscription webhook for a team with stored images', async () => {
      // Team has stored images but NO existing subscription; submitting the
      // empty webhook form clears (`updateTeamSubscription(undefined)`). With
      // the bug, `profile` would be rebuilt without `images`, emitting a
      // `remove /profile/images` op even though the user only touched the
      // subscription.
      const teamWithImagesNoSubscription: Team = {
        ...mockTeam,
        profile: {
          images: {
            image: 'https://cdn.example.com/avatar.png',
            image72: 'https://cdn.example.com/avatar72.png',
          },
        },
      };

      const updatedData = await submitSubscriptionForm(
        teamWithImagesNoSubscription
      );

      expect(mockUpdateTeamHandler).toHaveBeenCalledTimes(1);
      expect(updatedData.profile?.images).toEqual({
        image: 'https://cdn.example.com/avatar.png',
        image72: 'https://cdn.example.com/avatar72.png',
      });
      expect(updatedData.profile?.subscription).toBeUndefined();

      const jsonPatch = compare(teamWithImagesNoSubscription, updatedData);
      const imagesOps = jsonPatch.filter((op) =>
        op.path.startsWith('/profile/images')
      );

      expect(imagesOps).toEqual([]);
    });

    // Regression guard: for teams without a stored avatar the `images` key is
    // absent (NON_NULL serialization), so the bug is inert. The fix must keep
    // this path working — clearing a webhook for such a team still produces no
    // spurious `images` op and no breakage.
    it('should not break subscription clearing for a team without stored images', async () => {
      const updatedData = await submitSubscriptionForm(mockTeam);

      expect(mockUpdateTeamHandler).toHaveBeenCalledTimes(1);
      expect(updatedData.profile?.images).toBeUndefined();
      expect(updatedData.profile?.subscription).toBeUndefined();

      const jsonPatch = compare(mockTeam, updatedData);
      const imagesOps = jsonPatch.filter((op) =>
        op.path.startsWith('/profile/images')
      );

      expect(imagesOps).toEqual([]);
    });
  });
});
