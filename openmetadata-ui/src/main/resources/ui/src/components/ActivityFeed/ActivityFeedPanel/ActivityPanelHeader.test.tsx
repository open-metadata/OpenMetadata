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
} from '../../../generated/entity/activity/activityEvent';
import { getEntityFQN, getEntityType } from '../../../utils/FeedUtilsPure';
import ActivityPanelHeader from './ActivityPanelHeader';

jest.mock('../../../utils/FeedUtilsPure', () => ({
  ...jest.requireActual('../../../utils/FeedUtilsPure'),
  getEntityFQN: jest.fn().mockReturnValue('parsed.fqn'),
  getEntityType: jest.fn().mockReturnValue('parsedType'),
}));

jest.mock('../../../utils/FeedUtils', () => ({
  getActivityEventHeaderText: jest.fn().mockReturnValue('Updated'),
}));

jest.mock('../../../utils/EntityUtilClassBase', () => ({
  __esModule: true,
  default: {
    getEntityLink: jest.fn((type: string, fqn: string) => `/${type}/${fqn}`),
  },
}));

const activity: ActivityEvent = {
  about: '<#E::table::service.table::entityStatus>',
  entity: {
    id: 'table-id',
    type: 'table',
    name: 'table',
    fullyQualifiedName: 'service.table',
  },
  eventType: ActivityEventType.EntityUpdated,
  fieldName: 'entityStatus',
  id: 'activity-1',
  summary: 'Status updated',
  timestamp: 1,
};

const renderHeader = (event: ActivityEvent) =>
  render(
    <MemoryRouter>
      <ActivityPanelHeader hideCloseIcon activity={event} />
    </MemoryRouter>
  );

describe('ActivityPanelHeader', () => {
  beforeEach(() => jest.clearAllMocks());

  it('links the entity reference without parsing the about link', () => {
    renderHeader(activity);

    expect(screen.getByTestId('entitylink')).toHaveAttribute(
      'href',
      '/table/service.table'
    );
    expect(getEntityFQN).not.toHaveBeenCalled();
    expect(getEntityType).not.toHaveBeenCalled();
  });

  it('falls back to the about link when the event has no entity reference', () => {
    // `entity` is required by the schema; older stored events may lack it.
    renderHeader({
      ...activity,
      entity: undefined,
    } as unknown as ActivityEvent);

    expect(screen.getByTestId('entitylink')).toHaveAttribute(
      'href',
      '/parsedType/parsed.fqn'
    );
  });
});
