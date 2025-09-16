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
import {
  mockAlertDetails,
  MOCK_TYPED_EVENT_LIST_RESPONSE,
} from '../../../../mocks/Alerts.mock';
import { getAlertEventsFromId } from '../../../../rest/alertsAPI';
import AlertRecentEventsTab from './AlertRecentEventsTab';

jest.mock('../../../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn().mockReturnValue({
    currentPage: 8,
    paging: {},
    pageSize: 5,
    handlePagingChange: jest.fn(),
    handlePageChange: jest.fn(),
    handlePageSizeChange: jest.fn(),
    showPagination: true,
  }),
}));

jest.mock('../../../../rest/alertsAPI', () => ({
  getAlertEventsFromId: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_TYPED_EVENT_LIST_RESPONSE)),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockImplementation(() => <div>ErrorPlaceHolder</div>)
);

jest.mock('../../../common/NextPreviousWithOffset/NextPreviousWithOffset', () =>
  jest.fn().mockImplementation(() => <div>NextPreviousWithOffset</div>)
);

jest.mock('../../../Database/SchemaEditor/SchemaEditor', () =>
  jest.fn().mockImplementation(() => <div>SchemaEditor</div>)
);

describe('AlertRecentEventsTab', () => {
  it('should render the component', async () => {
    await act(async () => {
      render(<AlertRecentEventsTab alertDetails={mockAlertDetails} />);
    });

    expect(screen.getByText('label.description:')).toBeInTheDocument();
    expect(
      screen.getByText('message.alert-recent-events-description')
    ).toBeInTheDocument();

    expect(screen.getByTestId('recent-events-list')).toBeInTheDocument();
  });

  it('should display loading skeletons when loading', async () => {
    render(<AlertRecentEventsTab alertDetails={mockAlertDetails} />);

    expect(await screen.findAllByTestId('skeleton-loading-panel')).toHaveLength(
      5
    );
  });

  it('should display error placeholder when no data is available', async () => {
    (getAlertEventsFromId as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ data: [] })
    );

    await act(async () => {
      render(<AlertRecentEventsTab alertDetails={mockAlertDetails} />);
    });

    expect(screen.getByText('ErrorPlaceHolder')).toBeInTheDocument();
  });

  it('should display recent events list', async () => {
    await act(async () => {
      render(<AlertRecentEventsTab alertDetails={mockAlertDetails} />);
    });

    expect(screen.getByTestId('recent-events-list')).toBeInTheDocument();
  });

  it('should handle filter change', async () => {
    await act(async () => {
      render(<AlertRecentEventsTab alertDetails={mockAlertDetails} />);
    });

    const filterButton = screen.getByTestId('filter-button');
    fireEvent.click(filterButton);

    const filterOption = await screen.findByText('label.successful');
    fireEvent.click(filterOption);

    expect(await screen.findByTestId('applied-filter-text')).toHaveTextContent(
      ': label.successful'
    );
  });
});
