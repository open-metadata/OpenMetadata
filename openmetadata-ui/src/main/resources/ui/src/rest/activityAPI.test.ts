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

import { ReactionType } from '../generated/type/reaction';
import {
  addActivityReaction,
  createActivityReply,
  getActivityByEntityLink,
  getActivityCount,
  getActivityEvents,
  getEntityActivityByFqn,
  getEntityActivityById,
  getFollowingActivityFeed,
  getMyActivityFeed,
  getUserActivity,
  listActivityReplies,
  removeActivityReaction,
} from './activityAPI';
import APIClient from './index';

jest.mock('./index', () => ({
  delete: jest.fn(),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
}));

const response = { data: { id: 'activity-1' } };

describe('activityAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (APIClient.delete as jest.Mock).mockResolvedValue(response);
    (APIClient.get as jest.Mock).mockResolvedValue(response);
    (APIClient.post as jest.Mock).mockResolvedValue(response);
    (APIClient.put as jest.Mock).mockResolvedValue(response);
  });

  it('lists activity events', async () => {
    const params = { days: 7, limit: 50 };

    await getActivityEvents(params);

    expect(APIClient.get).toHaveBeenCalledWith('/activity', { params });
  });

  it('lists activity for an entity id', async () => {
    const params = { days: 30 };

    await getEntityActivityById('table', 'entity-1', params);

    expect(APIClient.get).toHaveBeenCalledWith(
      '/activity/entity/table/entity-1',
      { params }
    );
  });

  it('encodes the entity FQN', async () => {
    await getEntityActivityByFqn('table', 'service.数据 表');

    expect(APIClient.get).toHaveBeenCalledWith(
      '/activity/entity/table/name/service.%E6%95%B0%E6%8D%AE%20%E8%A1%A8',
      { params: undefined }
    );
  });

  it('lists user and current-user activity', async () => {
    await getUserActivity('user-1', { limit: 10 });
    await getMyActivityFeed({ limit: 20 });

    expect(APIClient.get).toHaveBeenNthCalledWith(1, '/activity/user/user-1', {
      params: { limit: 10 },
    });
    expect(APIClient.get).toHaveBeenNthCalledWith(2, '/activity/my-feed', {
      params: { limit: 20 },
    });
  });

  it('lists activity for followed entities', async () => {
    const params = { days: 7, limit: 10 };

    await getFollowingActivityFeed(params);

    expect(APIClient.get).toHaveBeenCalledWith('/activity/following', {
      params,
    });
  });

  it('lists followed activity without params', async () => {
    await getFollowingActivityFeed();

    expect(APIClient.get).toHaveBeenCalledWith('/activity/following', {
      params: undefined,
    });
  });

  it('lists activity by entity link and gets the count', async () => {
    const entityLink = '<#E::table::service.table>';

    await getActivityByEntityLink(entityLink, { days: 30 });
    await getActivityCount({ days: 30 });

    expect(APIClient.get).toHaveBeenNthCalledWith(1, '/activity/about', {
      params: { entityLink, days: 30 },
    });
    expect(APIClient.get).toHaveBeenNthCalledWith(2, '/activity/count', {
      params: { days: 30 },
    });
  });

  it('adds and removes an activity reaction', async () => {
    await addActivityReaction('activity-1', ReactionType.Heart);
    await removeActivityReaction('activity-1', ReactionType.Heart);

    const path = '/activity/activity-1/reaction/heart';

    expect(APIClient.put).toHaveBeenCalledWith(path);
    expect(APIClient.delete).toHaveBeenCalledWith(path);
  });

  it('lists activity replies with a cursor', async () => {
    const params = { after: 'next', limit: 20 };

    await listActivityReplies('activity-1', params);

    expect(APIClient.get).toHaveBeenCalledWith('/activity/activity-1/replies', {
      params,
    });
  });

  it('posts exactly one activity reply request', async () => {
    const request = { message: 'Reply' };

    await createActivityReply('activity-1', request);

    expect(APIClient.post).toHaveBeenCalledTimes(1);
    expect(APIClient.post).toHaveBeenCalledWith(
      '/activity/activity-1/replies',
      request
    );
  });
});
