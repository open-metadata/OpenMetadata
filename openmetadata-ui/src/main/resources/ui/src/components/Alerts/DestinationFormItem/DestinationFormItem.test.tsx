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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { Form, FormInstance } from 'antd';
import { DESTINATION_SOURCE_ITEMS } from '../../../constants/Alerts.constants';
import { SubscriptionCategory } from '../../../generated/events/api/createEventSubscription';
import { SubscriptionType } from '../../../generated/events/eventSubscription';
import { testAlertDestination } from '../../../rest/alertsAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import DestinationFormItem from './DestinationFormItem.component';

jest.mock('../../../rest/alertsAPI', () => ({
  testAlertDestination: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockGetFormattedDestinations = jest.fn();

jest.mock('../../../utils/Alerts/AlertsUtil', () => ({
  getDestinationConfigField: jest
    .fn()
    .mockReturnValue(<div data-testid="destination-field" />),
  getSubscriptionTypeOptions: jest.fn().mockReturnValue([]),
  listLengthValidator: jest.fn().mockImplementation(() => Promise.resolve()),
  getFilteredDestinationOptions: jest
    .fn()
    .mockImplementation((key) => DESTINATION_SOURCE_ITEMS[key]),
  getConnectionTimeoutField: jest
    .fn()
    .mockReturnValue(<div data-testid="connection-timeout" />),
  getReadTimeoutField: jest
    .fn()
    .mockReturnValue(<div data-testid="read-timeout" />),
  getFormattedDestinations: (...args: unknown[]) =>
    mockGetFormattedDestinations(...args),
}));

jest.mock('../../../utils/ObservabilityUtils', () => ({
  checkIfDestinationIsInternal: jest.fn().mockImplementation(() => false),
  getAlertDestinationCategoryIcons: jest
    .fn()
    .mockImplementation(() => <span data-testid="icon">Icon</span>),
}));

jest.mock('../../../components/common/FormCardSection/FormCardSection', () =>
  jest.fn().mockImplementation(({ heading, subHeading, children }) => (
    <div>
      <div>{heading}</div>
      <div>{subHeading}</div>
      <div>{children}</div>
    </div>
  ))
);

describe('DestinationFormItem', () => {
  it('should renders without crashing', () => {
    const setFieldValue = jest.fn();
    const getFieldValue = jest.fn();
    jest.spyOn(Form, 'useFormInstance').mockImplementation(
      () =>
        ({
          setFieldValue,
          getFieldValue,
        } as unknown as FormInstance)
    );

    const useWatchMock = jest.spyOn(Form, 'useWatch');
    useWatchMock.mockImplementation(() => ['container']);

    render(<DestinationFormItem />);

    expect(screen.getByText('label.destination')).toBeInTheDocument();
    expect(
      screen.getByText('message.alerts-destination-description')
    ).toBeInTheDocument();
    expect(screen.getByText('label.add-entity')).toBeInTheDocument();

    expect(screen.getByTestId('add-destination-button')).toBeInTheDocument();
  });

  it('add destination button should be disabled if there is no selected trigger', () => {
    const setFieldValue = jest.fn();
    const getFieldValue = jest.fn();
    jest.spyOn(Form, 'useFormInstance').mockImplementation(
      () =>
        ({
          setFieldValue,
          getFieldValue,
        } as unknown as FormInstance)
    );

    const useWatchMock = jest.spyOn(Form, 'useWatch');
    useWatchMock.mockImplementation(() => []);

    render(<DestinationFormItem />);

    expect(screen.getByTestId('add-destination-button')).toBeDisabled();
  });

  it('add destination button should be enabled if there is selected trigger', () => {
    const setFieldValue = jest.fn();
    const getFieldValue = jest.fn();
    jest.spyOn(Form, 'useFormInstance').mockImplementation(
      () =>
        ({
          setFieldValue,
          getFieldValue,
        } as unknown as FormInstance)
    );

    const useWatchMock = jest.spyOn(Form, 'useWatch');
    useWatchMock.mockImplementation(() => ['container']);

    render(<DestinationFormItem />);

    expect(screen.getByTestId('add-destination-button')).toBeEnabled();
  });

  it('should display the connection timeout field', () => {
    const setFieldValue = jest.fn();
    const getFieldValue = jest.fn();
    jest.spyOn(Form, 'useFormInstance').mockImplementation(
      () =>
        ({
          setFieldValue,
          getFieldValue,
        } as unknown as FormInstance)
    );

    const useWatchMock = jest.spyOn(Form, 'useWatch');
    useWatchMock.mockImplementation(() => ['container']);

    render(<DestinationFormItem />);

    expect(screen.getByTestId('connection-timeout')).toBeInTheDocument();
  });

  describe('handleTestDestinationClick', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should call testAlertDestination with formatted external destinations', async () => {
      const mockDestinations = [
        {
          destinationType: 'Webhook',
          category: SubscriptionCategory.External,
          type: SubscriptionType.Webhook,
          config: {
            endpoint: 'https://example.com/webhook',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            queryParams: [{ key: 'param1', value: 'value1' }],
          },
        },
        {
          destinationType: 'Slack',
          category: SubscriptionCategory.External,
          type: SubscriptionType.Slack,
          config: {
            webhookUrl: 'https://hooks.slack.com/services/xxx',
          },
        },
      ];

      const formattedDestinations = [
        {
          category: SubscriptionCategory.External,
          type: SubscriptionType.Webhook,
          config: {
            endpoint: 'https://example.com/webhook',
            headers: { 'Content-Type': 'application/json' },
            queryParams: { param1: 'value1' },
          },
        },
        {
          category: SubscriptionCategory.External,
          type: SubscriptionType.Slack,
          config: {
            webhookUrl: 'https://hooks.slack.com/services/xxx',
          },
        },
      ];

      const setFieldValue = jest.fn();
      const getFieldValue = jest.fn().mockReturnValue(mockDestinations);

      jest.spyOn(Form, 'useFormInstance').mockImplementation(
        () =>
          ({
            setFieldValue,
            getFieldValue,
          } as unknown as FormInstance)
      );

      const useWatchMock = jest.spyOn(Form, 'useWatch');
      useWatchMock.mockImplementation((path) => {
        if (path && path[0] === 'resources') {
          return ['container'];
        }
        if (path && path[0] === 'destinations') {
          return mockDestinations;
        }

        return undefined;
      });

      mockGetFormattedDestinations.mockReturnValue(formattedDestinations);
      (testAlertDestination as jest.Mock).mockResolvedValue([
        {
          category: SubscriptionCategory.External,
          type: SubscriptionType.Webhook,
          config: {
            endpoint: 'https://example.com/webhook',
            headers: { 'Content-Type': 'application/json' },
            queryParams: { param1: 'value1' },
          },
          statusDetails: { status: 200 },
        },
      ]);

      render(<DestinationFormItem />);

      const testButton = screen.getByTestId('test-destination-button');

      expect(testButton).toBeEnabled();

      await act(async () => {
        fireEvent.click(testButton);
      });

      await waitFor(() => {
        expect(mockGetFormattedDestinations).toHaveBeenCalledWith(
          mockDestinations
        );
      });

      await waitFor(() => {
        expect(testAlertDestination).toHaveBeenCalledWith({
          destinations: formattedDestinations,
        });
      });
    });

    it('should filter out internal destinations before testing', async () => {
      const mockDestinations = [
        {
          destinationType: 'Webhook',
          category: SubscriptionCategory.External,
          type: SubscriptionType.Webhook,
          config: {
            endpoint: 'https://example.com/webhook',
          },
        },
        {
          destinationType: 'Owners',
          category: SubscriptionCategory.Owners,
          type: SubscriptionType.Email,
          config: {},
        },
      ];

      const formattedDestinations = [
        {
          category: SubscriptionCategory.External,
          type: SubscriptionType.Webhook,
          config: {
            endpoint: 'https://example.com/webhook',
          },
        },
        {
          category: SubscriptionCategory.Owners,
          type: SubscriptionType.Email,
          config: {},
        },
      ];

      const setFieldValue = jest.fn();
      const getFieldValue = jest.fn().mockReturnValue(mockDestinations);

      jest.spyOn(Form, 'useFormInstance').mockImplementation(
        () =>
          ({
            setFieldValue,
            getFieldValue,
          } as unknown as FormInstance)
      );

      const useWatchMock = jest.spyOn(Form, 'useWatch');
      useWatchMock.mockImplementation((path) => {
        if (path && path[0] === 'resources') {
          return ['container'];
        }
        if (path && path[0] === 'destinations') {
          return mockDestinations;
        }

        return undefined;
      });

      mockGetFormattedDestinations.mockReturnValue(formattedDestinations);
      (testAlertDestination as jest.Mock).mockResolvedValue([]);

      render(<DestinationFormItem />);

      const testButton = screen.getByTestId('test-destination-button');

      await act(async () => {
        fireEvent.click(testButton);
      });

      await waitFor(() => {
        expect(testAlertDestination).toHaveBeenCalledWith({
          destinations: [
            {
              category: SubscriptionCategory.External,
              type: SubscriptionType.Webhook,
              config: {
                endpoint: 'https://example.com/webhook',
              },
            },
          ],
        });
      });
    });

    it('should filter out external destinations with empty config', async () => {
      const mockDestinations = [
        {
          destinationType: 'Webhook',
          category: SubscriptionCategory.External,
          type: SubscriptionType.Webhook,
          config: {
            endpoint: 'https://example.com/webhook',
          },
        },
        {
          destinationType: 'Slack',
          category: SubscriptionCategory.External,
          type: SubscriptionType.Slack,
          config: {},
        },
      ];

      const formattedDestinations = [
        {
          category: SubscriptionCategory.External,
          type: SubscriptionType.Webhook,
          config: {
            endpoint: 'https://example.com/webhook',
          },
        },
        {
          category: SubscriptionCategory.External,
          type: SubscriptionType.Slack,
          config: {},
        },
      ];

      const setFieldValue = jest.fn();
      const getFieldValue = jest.fn().mockReturnValue(mockDestinations);

      jest.spyOn(Form, 'useFormInstance').mockImplementation(
        () =>
          ({
            setFieldValue,
            getFieldValue,
          } as unknown as FormInstance)
      );

      const useWatchMock = jest.spyOn(Form, 'useWatch');
      useWatchMock.mockImplementation((path) => {
        if (path && path[0] === 'resources') {
          return ['container'];
        }
        if (path && path[0] === 'destinations') {
          return mockDestinations;
        }

        return undefined;
      });

      mockGetFormattedDestinations.mockReturnValue(formattedDestinations);
      (testAlertDestination as jest.Mock).mockResolvedValue([]);

      render(<DestinationFormItem />);

      const testButton = screen.getByTestId('test-destination-button');

      await act(async () => {
        fireEvent.click(testButton);
      });

      await waitFor(() => {
        expect(testAlertDestination).toHaveBeenCalledWith({
          destinations: [
            {
              category: SubscriptionCategory.External,
              type: SubscriptionType.Webhook,
              config: {
                endpoint: 'https://example.com/webhook',
              },
            },
          ],
        });
      });
    });

    it('should handle errors and show error toast', async () => {
      const mockError = new Error('Network error');
      const mockDestinations = [
        {
          destinationType: 'Webhook',
          category: SubscriptionCategory.External,
          type: SubscriptionType.Webhook,
          config: {
            endpoint: 'https://example.com/webhook',
          },
        },
      ];

      const setFieldValue = jest.fn();
      const getFieldValue = jest.fn().mockReturnValue(mockDestinations);

      jest.spyOn(Form, 'useFormInstance').mockImplementation(
        () =>
          ({
            setFieldValue,
            getFieldValue,
          } as unknown as FormInstance)
      );

      const useWatchMock = jest.spyOn(Form, 'useWatch');
      useWatchMock.mockImplementation((path) => {
        if (path && path[0] === 'resources') {
          return ['container'];
        }
        if (path && path[0] === 'destinations') {
          return mockDestinations;
        }

        return undefined;
      });

      mockGetFormattedDestinations.mockReturnValue([
        {
          category: SubscriptionCategory.External,
          type: SubscriptionType.Webhook,
          config: {
            endpoint: 'https://example.com/webhook',
          },
        },
      ]);
      (testAlertDestination as jest.Mock).mockRejectedValue(mockError);

      render(<DestinationFormItem />);

      const testButton = screen.getByTestId('test-destination-button');

      await act(async () => {
        fireEvent.click(testButton);
      });

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(mockError);
      });
    });

    it('should not call API when getFormattedDestinations returns undefined', async () => {
      const mockDestinations = [
        {
          destinationType: 'Webhook',
          category: SubscriptionCategory.External,
          type: SubscriptionType.Webhook,
          config: {},
        },
      ];

      const setFieldValue = jest.fn();
      const getFieldValue = jest.fn().mockReturnValue(mockDestinations);

      jest.spyOn(Form, 'useFormInstance').mockImplementation(
        () =>
          ({
            setFieldValue,
            getFieldValue,
          } as unknown as FormInstance)
      );

      const useWatchMock = jest.spyOn(Form, 'useWatch');
      useWatchMock.mockImplementation((path) => {
        if (path && path[0] === 'resources') {
          return ['container'];
        }
        if (path && path[0] === 'destinations') {
          return mockDestinations;
        }

        return undefined;
      });

      mockGetFormattedDestinations.mockReturnValue(undefined);

      render(<DestinationFormItem />);

      const testButton = screen.getByTestId('test-destination-button');

      await act(async () => {
        fireEvent.click(testButton);
      });

      await waitFor(() => {
        expect(mockGetFormattedDestinations).toHaveBeenCalled();
      });

      expect(testAlertDestination).not.toHaveBeenCalled();
    });

    it('test destination button should be disabled when no external destination is selected', () => {
      const mockDestinations = [
        {
          destinationType: 'Owners',
          category: SubscriptionCategory.Owners,
          type: SubscriptionType.Email,
          config: {},
        },
      ];

      const setFieldValue = jest.fn();
      const getFieldValue = jest.fn();

      jest.spyOn(Form, 'useFormInstance').mockImplementation(
        () =>
          ({
            setFieldValue,
            getFieldValue,
          } as unknown as FormInstance)
      );

      const useWatchMock = jest.spyOn(Form, 'useWatch');
      useWatchMock.mockImplementation((path) => {
        if (path && path[0] === 'resources') {
          return ['container'];
        }
        if (path && path[0] === 'destinations') {
          return mockDestinations;
        }

        return undefined;
      });

      render(<DestinationFormItem />);

      const testButton = screen.getByTestId('test-destination-button');

      expect(testButton).toBeDisabled();
    });

    it('test destination button should be enabled when external destination is selected', () => {
      const mockDestinations = [
        {
          destinationType: 'Webhook',
          category: SubscriptionCategory.External,
          type: SubscriptionType.Webhook,
          config: {
            endpoint: 'https://example.com/webhook',
          },
        },
      ];

      const setFieldValue = jest.fn();
      const getFieldValue = jest.fn();

      jest.spyOn(Form, 'useFormInstance').mockImplementation(
        () =>
          ({
            setFieldValue,
            getFieldValue,
          } as unknown as FormInstance)
      );

      const useWatchMock = jest.spyOn(Form, 'useWatch');
      useWatchMock.mockImplementation((path) => {
        if (path && path[0] === 'resources') {
          return ['container'];
        }
        if (path && path[0] === 'destinations') {
          return mockDestinations;
        }

        return undefined;
      });

      render(<DestinationFormItem />);

      const testButton = screen.getByTestId('test-destination-button');

      expect(testButton).toBeEnabled();
    });
  });
});
