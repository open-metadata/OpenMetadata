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
import { getBots } from '../../../../rest/botsAPI';
import {
  cursorPage,
  CursorRequest,
  expectCursorPaging,
} from '../../../../test/unit/pagingScenarios';
import BotListV1 from './BotListV1.component';

jest.mock(
  '../../../common/Table/TableV2',
  () => jest.requireActual('../../../../test/unit/pagingScenarios').TableV2Stub
);

jest.mock('../../../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({ isAdminUser: true }),
}));

jest.mock('../../../../rest/botsAPI', () => ({
  getBots: jest.fn(),
}));

jest.mock('../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

const mockGetBots = getBots as jest.Mock;

// The search-resolution map also calls getBots, always at this fixed size; it is not paging.
const BOT_MAP_LIMIT = 100;

const lastListRequest = () =>
  mockGetBots.mock.calls
    .map(([request]) => request as CursorRequest)
    .filter(({ limit }) => limit !== BOT_MAP_LIMIT)
    .at(-1);

describe('BotListV1 pagination', () => {
  beforeEach(() => {
    mockGetBots.mockImplementation(async (req: CursorRequest) =>
      cursorPage(req)
    );
  });

  it('pages bots by cursor and keeps the page across a reload', async () => {
    await expectCursorPaging({
      url: '/settings/bots?pageSize=15',
      ui: (
        <BotListV1
          handleAddBotClick={jest.fn()}
          handleShowDeleted={jest.fn()}
          showDeleted={false}
        />
      ),
      lastListRequest,
    });
  });
});
