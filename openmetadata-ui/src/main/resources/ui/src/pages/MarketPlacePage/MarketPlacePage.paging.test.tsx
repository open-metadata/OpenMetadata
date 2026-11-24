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
import { fireEvent, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  AppType,
  Permissions,
  ScheduleType,
} from '../../generated/entity/applications/marketplace/appMarketPlaceDefinition';
import { getMarketPlaceApplicationList } from '../../rest/applicationMarketPlaceAPI';
import MarketPlacePage from './MarketPlacePage';

jest.mock('../../rest/applicationMarketPlaceAPI', () => ({
  getMarketPlaceApplicationList: jest.fn(),
}));

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn(({ children }: { children: ReactNode }) => <>{children}</>)
);

jest.mock('../../components/PageHeader/PageHeader.component', () =>
  jest.fn(() => null)
);

jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => jest.fn(() => null)
);

describe('MarketPlacePage paging', () => {
  it('fetches the next page once and displays the returned application', async () => {
    const list = jest.mocked(getMarketPlaceApplicationList);
    list
      .mockResolvedValueOnce({
        data: [
          {
            id: 'first',
            name: 'FirstApp',
            fullyQualifiedName: 'FirstApp',
            displayName: 'First application',
            appType: AppType.Internal,
            className:
              'org.openmetadata.service.apps.AbstractNativeApplication',
            permission: Permissions.All,
            scheduleType: ScheduleType.OnlyManual,
          },
        ],
        paging: { total: 30, after: 'next-cursor' },
      })
      .mockResolvedValue({
        data: [
          {
            id: 'next',
            name: 'NextApp',
            fullyQualifiedName: 'NextApp',
            displayName: 'Next application',
            appType: AppType.Internal,
            className:
              'org.openmetadata.service.apps.AbstractNativeApplication',
            permission: Permissions.All,
            scheduleType: ScheduleType.OnlyManual,
          },
        ],
        paging: { total: 30, before: 'previous-cursor' },
      });

    render(
      <MemoryRouter>
        <MarketPlacePage />
      </MemoryRouter>
    );

    expect(await screen.findByText('First application')).toBeInTheDocument();

    list.mockClear();
    fireEvent.click(screen.getByTestId('next'));

    expect(await screen.findByText('Next application')).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ after: 'next-cursor' })
    );
    expect(screen.queryByText('First application')).not.toBeInTheDocument();
    expect(screen.getByTestId('page-indicator')).toHaveTextContent(
      'label.page 2'
    );
  });
});
