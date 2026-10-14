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
import { getAlertsFromName, getAllAlerts } from '../../rest/alertsAPI';
import {
  cursorPage,
  CursorRequest,
  expectCursorPaging,
} from '../../test/unit/pagingScenarios';
import ObservabilityAlertsPage from './ObservabilityAlertsPage';

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children }) => <div>{children}</div>)
);

jest.mock(
  '../../components/common/RichTextEditor/RichTextEditorPreviewNew',
  () => jest.fn().mockReturnValue(null)
);

jest.mock(
  '../../components/Learning/LearningIcon/LearningIcon.component',
  () => ({ LearningIcon: jest.fn().mockReturnValue(null) })
);

jest.mock('../../rest/alertsAPI', () => ({
  getAllAlerts: jest.fn(),
  getAlertsFromName: jest.fn(),
}));

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    getEntityPermissionByFqn: jest.fn().mockResolvedValue({}),
    getResourcePermission: jest.fn().mockResolvedValue({}),
  }),
}));

const mockGetAllAlerts = getAllAlerts as jest.Mock;

const lastListRequest = () =>
  mockGetAllAlerts.mock.calls.at(-1)?.[0] as CursorRequest | undefined;

describe('ObservabilityAlertsPage pagination', () => {
  beforeEach(() => {
    mockGetAllAlerts.mockImplementation(async (req: CursorRequest) =>
      cursorPage(req)
    );
    (getAlertsFromName as jest.Mock).mockRejectedValue(new Error('unused'));
  });

  it('pages observability alerts by cursor and keeps the page across a reload', async () => {
    await expectCursorPaging({
      url: '/observability/alerts?pageSize=15',
      ui: <ObservabilityAlertsPage />,
      lastListRequest,
    });
  });
});
