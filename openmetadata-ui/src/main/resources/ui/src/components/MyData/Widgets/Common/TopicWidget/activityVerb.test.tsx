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
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  ActivityEvent,
  ActivityEventType,
} from '../../../../../generated/entity/activity/activityEvent';
import { ActivitySentence, getActivitySentenceKey } from './activityVerb';

// Renders the key and each named slot with its value, so a test can see which
// sentence was chosen and what filled it.
jest.mock('react-i18next', () => {
  const { cloneElement } = jest.requireActual('react');

  return {
    Trans: ({
      i18nKey,
      values,
      components,
    }: {
      i18nKey: string;
      values: Record<string, string>;
      components: Record<string, React.ReactElement>;
    }) => (
      <span data-key={i18nKey} data-testid="sentence">
        {cloneElement(components.actor, {}, values.actor)}
        {cloneElement(components.entity, {}, values.entity)}
      </span>
    ),
  };
});

const event = (eventType: ActivityEventType): ActivityEvent =>
  ({
    actor: { displayName: 'Ada', id: 'u1', name: 'ada', type: 'user' },
    entity: {
      displayName: 'orders',
      fullyQualifiedName: 'svc.db.orders',
      id: 't1',
      type: 'table',
    },
    eventType,
    id: 'evt-1',
    timestamp: 1000,
  } as ActivityEvent);

describe('getActivitySentenceKey', () => {
  it.each([
    [
      ActivityEventType.DescriptionUpdated,
      'message.activity-actor-updated-description-of-entity',
    ],
    [
      ActivityEventType.TagsUpdated,
      'message.activity-actor-updated-tags-of-entity',
    ],
    [
      ActivityEventType.OwnerUpdated,
      'message.activity-actor-updated-owners-of-entity',
    ],
    [ActivityEventType.EntityCreated, 'message.activity-actor-created-entity'],
    [
      ActivityEventType.EntitySoftDeleted,
      'message.activity-actor-deleted-entity',
    ],
    [
      ActivityEventType.TestCaseStatusChanged,
      'message.activity-actor-changed-status-of-entity',
    ],
  ])('maps %s to one whole-sentence key', (eventType, key) => {
    expect(getActivitySentenceKey(eventType)).toBe(key);
  });

  it('reads an unmapped event as a generic update', () => {
    expect(getActivitySentenceKey('SomethingNew' as ActivityEventType)).toBe(
      'message.activity-actor-updated-entity'
    );
  });
});

describe('ActivitySentence', () => {
  // The old helper concatenated "updated" + a lowercased field noun, which
  // broke word order and German noun capitalisation.
  it('renders the event as a single translated sentence with actor and entity slots', () => {
    render(<ActivitySentence event={event(ActivityEventType.TierUpdated)} />);

    const sentence = screen.getByTestId('sentence');

    expect(sentence).toHaveAttribute(
      'data-key',
      'message.activity-actor-updated-tier-of-entity'
    );
    expect(sentence).toHaveTextContent('Adaorders');
  });

  it('links the entity only when given a link', () => {
    const { unmount } = render(
      <ActivitySentence event={event(ActivityEventType.EntityUpdated)} />
    );

    expect(screen.queryByTestId('activity-entity-link-evt-1')).toBeNull();

    unmount();
    render(
      <MemoryRouter>
        <ActivitySentence
          entityLink="/table/svc.db.orders"
          event={event(ActivityEventType.EntityUpdated)}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId('activity-entity-link-evt-1')).toHaveAttribute(
      'href',
      '/table/svc.db.orders'
    );
  });
});
