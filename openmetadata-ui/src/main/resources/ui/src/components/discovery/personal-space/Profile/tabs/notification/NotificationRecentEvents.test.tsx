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

import { act, render, screen, waitFor } from '@testing-library/react';
import { EventSubscription } from '../../../../../../generated/events/eventSubscription';
import NotificationRecentEvents from './NotificationRecentEvents';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  ...jest.requireActual('@openmetadata/ui-core-components'),
  Accordion: jest
    .fn()
    .mockImplementation(({ children }) => (
      <div data-testid="accordion">{children}</div>
    )),
  AccordionHeader: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
  AccordionItem: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
  AccordionPanel: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
  Box: jest
    .fn()
    .mockImplementation(({ children, ...props }) => (
      <div {...props}>{children}</div>
    )),
  Button: jest
    .fn()
    .mockImplementation(({ children, onPress, ...props }) => (
      <button {...props} onClick={onPress}>
        {children}
      </button>
    )),
  Dropdown: {
    Root: jest
      .fn()
      .mockImplementation(({ children }) => <div>{children}</div>),
    Popover: jest
      .fn()
      .mockImplementation(({ children }) => <div>{children}</div>),
    Menu: jest
      .fn()
      .mockImplementation(({ children }) => (
        <div data-testid="filter-menu">{children}</div>
      )),
    Item: jest
      .fn()
      .mockImplementation(({ children }) => <div>{children}</div>),
  },
  EmptyPlaceholder: jest.fn(() => <div data-testid="empty-placeholder" />),
  PaginationCardWithControls: jest.fn(() => null),
  Skeleton: jest.fn(() => <div data-testid="skeleton" />),
  Tooltip: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
  Typography: jest
    .fn()
    .mockImplementation(({ children }) => <span>{children}</span>),
}));

jest.mock('@untitledui/icons', () => ({
  Bell01: jest.fn(() => <span>bell-icon</span>),
  FilterLines: jest.fn(() => <span>filter-icon</span>),
}));

jest.mock('../../../../../../rest/alertsAPI', () => ({
  getAlertEventsFromId: jest
    .fn()
    .mockResolvedValue({ data: [], paging: { total: 0 } }),
}));

jest.mock('../../../../../../hooks/useSettingsHash', () => ({
  useSettingsHash: () => ({
    state: { params: {} },
    updateParams: jest.fn(),
  }),
}));

jest.mock('../../../../../../utils/EntityNameUtils', () => ({
  getEntityName: jest.fn((entity) => entity.name ?? ''),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../../../../utils/Alerts/AlertsUtil', () => ({
  getAlertStatusIcon: jest.fn(() => <span>status-icon</span>),
}));

jest.mock('../../../../../../utils/Alerts/AlertsUtilPure', () => ({
  getAlertEventsFilterLabels: jest.fn((key: string) => key),
  getChangeEventDataFromTypedEvent: jest.fn(() => ({
    changeEventData: {
      id: 'event-1',
      timestamp: 1234567890,
      entityType: 'table',
    },
    changeEventDataToDisplay: {},
  })),
  getLabelsForEventDetails: jest.fn((key: string) => key),
}));

jest.mock('../../../../../../utils/date-time/DateTimeUtils', () => ({
  formatDateTime: jest.fn(() => 'mock-date'),
}));

jest.mock('../../../../../../utils/SearchClassBase', () => ({
  __esModule: true,
  default: {
    getEntityIcon: jest.fn(() => <span>entity-icon</span>),
  },
}));

jest.mock('../../../../../AppRouter/withSuspenseFallback', () => ({
  withSuspenseFallback: (component: unknown) => component,
}));

jest.mock('../../../../../Database/SchemaEditor/SchemaEditor', () =>
  jest.fn(() => <div data-testid="schema-editor" />)
);

jest.mock('../../../../../../assets/svg/ic-filter-off.svg', () => ({
  ReactComponent: jest.fn(() => <span>filter-off-icon</span>),
}));

jest.mock('../../../../../../constants/constants', () => ({
  PAGE_SIZE_BASE: 10,
  PAGE_SIZE_MEDIUM: 25,
  PAGE_SIZE_LARGE: 50,
}));

const mockAlert = {
  id: 'alert-1',
  name: 'test-alert',
} as unknown as EventSubscription;

describe('NotificationRecentEvents', () => {
  it('should show empty placeholder when no events', async () => {
    await act(async () => {
      render(<NotificationRecentEvents alertDetails={mockAlert} />);
    });

    await waitFor(() => {
      expect(screen.getByTestId('empty-placeholder')).toBeInTheDocument();
    });
  });

  it('should render filter button', async () => {
    await act(async () => {
      render(<NotificationRecentEvents alertDetails={mockAlert} />);
    });

    expect(screen.getByTestId('filter-button')).toBeInTheDocument();
  });

  it('should show skeletons while loading', async () => {
    const { getAlertEventsFromId } = jest.requireMock(
      '../../../../../../rest/alertsAPI'
    );

    getAlertEventsFromId.mockReturnValue(new Promise(() => {}));

    await act(async () => {
      render(<NotificationRecentEvents alertDetails={mockAlert} />);
    });

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);

    getAlertEventsFromId.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
  });
});
