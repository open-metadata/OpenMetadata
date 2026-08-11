/*
 *  Copyright 2025 Collate.
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
import { EntityType } from '../../../../../enums/entity.enum';
import { ActivityEvent } from '../../../../../generated/entity/activity/activityEvent';
import { EntityReference } from '../../../../../generated/entity/type';
import ActivityOwnersFeed from './ActivityOwnersFeed';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../../../common/PopOverCard/UserPopOverCard', () => {
  return jest.fn(({ children, userName }) => (
    <div data-testid={`user-popover-${userName}`}>{children}</div>
  ));
});

jest.mock('../../../../common/ProfilePicture/ProfilePicture', () => {
  return jest.fn(({ name, displayName }) => (
    <div data-testid={`profile-picture-${name}`}>{displayName}</div>
  ));
});

jest.mock('../../../../common/OwnerItem/OwnerItem', () => ({
  OwnerItem: jest.fn(({ owner }) => (
    <div data-testid={`owner-item-${owner.id}`}>{owner.displayName}</div>
  )),
}));

jest.mock('../../../../common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: jest.fn(({ owners }) => (
    <div data-testid="owner-label">{owners.length} owners</div>
  )),
}));

const createOwner = (
  id: string,
  name: string,
  type: EntityType = EntityType.USER
): EntityReference => ({
  id,
  name,
  displayName: name.charAt(0).toUpperCase() + name.slice(1),
  type,
});

const createOwnersJson = (owners: EntityReference[]): string => {
  return JSON.stringify(owners);
};

const createMockActivity = (
  oldValue?: string,
  newValue?: string
): ActivityEvent => ({
  id: 'activity-123',
  timestamp: 1234567890,
  eventType: 'entityUpdated' as ActivityEvent['eventType'],
  actor: { id: 'user-1', type: 'user', name: 'testuser' },
  entity: { id: 'entity-1', type: 'table', name: 'testTable' },
  about: '<#E::table::test>',
  summary: 'Updated owners',
  oldValue,
  newValue,
});

describe('ActivityOwnersFeed', () => {
  describe('Owner Addition', () => {
    it('should display added owners with add icon', () => {
      const newOwner = createOwner('user-1', 'newuser');
      const activity = createMockActivity(
        createOwnersJson([]),
        createOwnersJson([newOwner])
      );

      render(<ActivityOwnersFeed activity={activity} />);

      expect(screen.getByTestId('profile-picture-newuser')).toBeInTheDocument();
    });

    it('should show owners label when owners are added', () => {
      const newOwner = createOwner('user-1', 'newuser');
      const activity = createMockActivity(
        createOwnersJson([]),
        createOwnersJson([newOwner])
      );

      render(<ActivityOwnersFeed activity={activity} />);

      expect(
        screen.getByText('label.owner-plural-with-colon')
      ).toBeInTheDocument();
    });

    it('should only show newly added owners', () => {
      const existingOwner = createOwner('user-1', 'existing');
      const newOwner = createOwner('user-2', 'newowner');
      const activity = createMockActivity(
        createOwnersJson([existingOwner]),
        createOwnersJson([existingOwner, newOwner])
      );

      render(<ActivityOwnersFeed activity={activity} />);

      expect(
        screen.getByTestId('profile-picture-newowner')
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId('profile-picture-existing')
      ).not.toBeInTheDocument();
    });
  });

  describe('Owner Removal', () => {
    it('should display removed owners with delete icon', () => {
      const removedOwner = createOwner('user-1', 'removeduser');
      const activity = createMockActivity(
        createOwnersJson([removedOwner]),
        createOwnersJson([])
      );

      render(<ActivityOwnersFeed activity={activity} />);

      expect(
        screen.getByTestId('profile-picture-removeduser')
      ).toBeInTheDocument();
    });

    it('should only show removed owners', () => {
      const remainingOwner = createOwner('user-1', 'remaining');
      const removedOwner = createOwner('user-2', 'removed');
      const activity = createMockActivity(
        createOwnersJson([remainingOwner, removedOwner]),
        createOwnersJson([remainingOwner])
      );

      render(<ActivityOwnersFeed activity={activity} />);

      expect(screen.getByTestId('profile-picture-removed')).toBeInTheDocument();
      expect(
        screen.queryByTestId('profile-picture-remaining')
      ).not.toBeInTheDocument();
    });
  });

  describe('Owner Addition and Removal', () => {
    it('should display both added and removed owners', () => {
      const oldOwner = createOwner('user-1', 'oldowner');
      const newOwner = createOwner('user-2', 'newowner');
      const activity = createMockActivity(
        createOwnersJson([oldOwner]),
        createOwnersJson([newOwner])
      );

      render(<ActivityOwnersFeed activity={activity} />);

      expect(
        screen.getByTestId('profile-picture-oldowner')
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('profile-picture-newowner')
      ).toBeInTheDocument();
    });

    it('should show two owner labels when both add and remove', () => {
      const oldOwner = createOwner('user-1', 'oldowner');
      const newOwner = createOwner('user-2', 'newowner');
      const activity = createMockActivity(
        createOwnersJson([oldOwner]),
        createOwnersJson([newOwner])
      );

      render(<ActivityOwnersFeed activity={activity} />);

      const ownerLabels = screen.getAllByText('label.owner-plural-with-colon');

      expect(ownerLabels).toHaveLength(2);
    });
  });

  describe('Team Owners', () => {
    it('should render OwnerItem for team type owners', () => {
      const teamOwner = createOwner('team-1', 'engineering', EntityType.TEAM);
      const activity = createMockActivity(
        createOwnersJson([]),
        createOwnersJson([teamOwner])
      );

      render(<ActivityOwnersFeed activity={activity} />);

      expect(screen.getByTestId('owner-item-team-1')).toBeInTheDocument();
    });

    it('should render ProfilePicture for user type owners', () => {
      const userOwner = createOwner('user-1', 'testuser', EntityType.USER);
      const activity = createMockActivity(
        createOwnersJson([]),
        createOwnersJson([userOwner])
      );

      render(<ActivityOwnersFeed activity={activity} />);

      expect(
        screen.getByTestId('profile-picture-testuser')
      ).toBeInTheDocument();
    });
  });

  describe('No Changes', () => {
    it('should not render when no owners changed', () => {
      const owner = createOwner('user-1', 'sameowner');
      const activity = createMockActivity(
        createOwnersJson([owner]),
        createOwnersJson([owner])
      );

      render(<ActivityOwnersFeed activity={activity} />);

      expect(
        screen.queryByTestId('profile-picture-sameowner')
      ).not.toBeInTheDocument();
    });

    it('should not render when both old and new are empty', () => {
      const activity = createMockActivity(
        createOwnersJson([]),
        createOwnersJson([])
      );

      render(<ActivityOwnersFeed activity={activity} />);

      expect(
        screen.queryByText('label.owner-plural-with-colon')
      ).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined oldValue', () => {
      const newOwner = createOwner('user-1', 'newowner');
      const activity = createMockActivity(
        undefined,
        createOwnersJson([newOwner])
      );

      render(<ActivityOwnersFeed activity={activity} />);

      expect(
        screen.getByTestId('profile-picture-newowner')
      ).toBeInTheDocument();
    });

    it('should handle undefined newValue', () => {
      const oldOwner = createOwner('user-1', 'oldowner');
      const activity = createMockActivity(
        createOwnersJson([oldOwner]),
        undefined
      );

      render(<ActivityOwnersFeed activity={activity} />);

      expect(
        screen.getByTestId('profile-picture-oldowner')
      ).toBeInTheDocument();
    });

    it('should handle invalid JSON in oldValue', () => {
      const newOwner = createOwner('user-1', 'newowner');
      const activity = createMockActivity(
        'invalid json',
        createOwnersJson([newOwner])
      );

      render(<ActivityOwnersFeed activity={activity} />);

      expect(
        screen.getByTestId('profile-picture-newowner')
      ).toBeInTheDocument();
    });

    it('should handle invalid JSON in newValue', () => {
      const oldOwner = createOwner('user-1', 'oldowner');
      const activity = createMockActivity(
        createOwnersJson([oldOwner]),
        'invalid json'
      );

      render(<ActivityOwnersFeed activity={activity} />);

      expect(
        screen.getByTestId('profile-picture-oldowner')
      ).toBeInTheDocument();
    });

    it('should handle single owner object instead of array', () => {
      const singleOwner = createOwner('user-1', 'singleowner');
      const activity = createMockActivity(
        JSON.stringify(singleOwner),
        createOwnersJson([])
      );

      render(<ActivityOwnersFeed activity={activity} />);

      expect(
        screen.getByTestId('profile-picture-singleowner')
      ).toBeInTheDocument();
    });
  });

  describe('Feed Tab vs Card Display', () => {
    it('should apply showThread styles when provided', () => {
      const newOwner = createOwner('user-1', 'newowner');
      const activity = createMockActivity(
        createOwnersJson([]),
        createOwnersJson([newOwner])
      );

      const { container } = render(
        <ActivityOwnersFeed showThread activity={activity} />
      );

      expect(container.querySelector('.bg-white')).toBeInTheDocument();
    });
  });
});
