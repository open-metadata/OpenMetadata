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
/*
 * Copyright 2025 Collate
 */
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { getAuditLogs } from '../../rest/auditLogAPI';
import { AuditLogListResponse } from '../../types/auditLogs.interface';
import AuditLogsPage from './AuditLogsPage';

jest.mock('../../rest/auditLogAPI', () => ({
  getAuditLogs: jest.fn().mockResolvedValue({
    data: [],
    paging: {
      total: 0,
    },
  } as AuditLogListResponse),
}));

jest.mock('../../components/PageHeader/PageHeader.component', () =>
  jest.fn().mockReturnValue(<div data-testid="page-header" />)
);

jest.mock('../../components/common/NextPrevious/NextPrevious', () =>
  jest.fn().mockReturnValue(<div data-testid="next-previous" />)
);

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../rest/miscAPI', () => ({
  searchData: jest.fn().mockResolvedValue({
    data: {
      hits: {
        hits: [],
        total: { value: 0 },
      },
    },
  }),
}));

jest.mock('../../rest/userAPI', () => ({
  getUsers: jest.fn().mockResolvedValue({
    data: [],
    paging: { total: 0 },
  }),
}));

jest.mock(
  '../../components/common/SelectableList/SelectableList.component',
  () => jest.fn().mockReturnValue(<div data-testid="selectable-list" />)
);

describe('AuditLogsPage', () => {
  it('fetches audit logs on mount', async () => {
    render(
      <MemoryRouter>
        <AuditLogsPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(getAuditLogs).toHaveBeenCalledTimes(1));
  });
});
