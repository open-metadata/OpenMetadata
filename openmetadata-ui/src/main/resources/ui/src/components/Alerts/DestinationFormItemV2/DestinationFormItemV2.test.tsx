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
import { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import {
  SubscriptionCategory,
  SubscriptionType,
} from '../../../generated/events/eventSubscription';
import { testAlertDestination } from '../../../rest/alertsAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import DestinationFormItemV2 from './DestinationFormItemV2.component';

jest.mock('../../../rest/alertsAPI', () => ({
  testAlertDestination: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const mockGetFormattedDestinations = jest.fn();

jest.mock('../../../utils/Alerts/AlertsUtilPure', () => ({
  getFormattedDestinations: (...args: unknown[]) =>
    mockGetFormattedDestinations(...args),
}));

jest.mock('./DestinationSelectItemV2/DestinationSelectItemV2', () =>
  jest
    .fn()
    .mockImplementation(
      ({ id, remove }: { id: number; remove: (i: number) => void }) => (
        <div data-testid={`destination-select-item-${id}`}>
          <button
            data-testid={`remove-destination-${id}`}
            onClick={() => remove(id)}>
            Remove
          </button>
        </div>
      )
    )
);

jest.mock('@openmetadata/ui-core-components', () => {
  const CardHeader = ({
    title,
    subtitle,
  }: {
    title?: ReactNode;
    subtitle?: ReactNode;
  }) => (
    <div>
      <div>{title}</div>
      <div>{subtitle}</div>
    </div>
  );

  const CardContent = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );

  const Card = ({ children }: { children?: ReactNode }) => (
    <div data-testid="card">{children}</div>
  );

  Card.Header = CardHeader;
  Card.Content = CardContent;

  const GridItem = ({
    children,
    'data-testid': tid,
  }: {
    children?: ReactNode;
    'data-testid'?: string;
  }) => <div data-testid={tid}>{children}</div>;

  const Grid = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );

  Grid.Item = GridItem;

  return {
    Button: ({
      onPress,
      children,
      isDisabled,
      'data-testid': tid,
    }: {
      onPress?: () => void;
      children?: ReactNode;
      isDisabled?: boolean;
      'data-testid'?: string;
    }) => (
      <button data-testid={tid} disabled={isDisabled} onClick={onPress}>
        {children}
      </button>
    ),
    Card,
    Divider: () => <hr />,
    Grid,
    Input: ({
      onChange,
      value,
      'data-testid': tid,
      inputDataTestId,
      defaultValue,
    }: {
      onChange?: (val: string) => void;
      value?: string;
      'data-testid'?: string;
      inputDataTestId?: string;
      defaultValue?: string;
    }) => (
      <input
        data-testid={inputDataTestId ?? tid}
        defaultValue={defaultValue}
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
      />
    ),
    Tooltip: ({ children }: { children?: ReactNode }) => <>{children}</>,
    Typography: ({
      children,
      as: Tag = 'span',
    }: {
      children?: ReactNode;
      as?: keyof JSX.IntrinsicElements;
    }) => <Tag>{children}</Tag>,
  };
});

function renderWithForm(
  ui: React.ReactElement,
  defaultValues: Record<string, unknown> = {}
) {
  function Wrapper({ children }: { children: ReactNode }) {
    const methods = useForm({ defaultValues });

    return <FormProvider {...methods}>{children}</FormProvider>;
  }

  return render(ui, { wrapper: Wrapper });
}

describe('DestinationFormItemV2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title, subtitle and add destination button', () => {
    renderWithForm(<DestinationFormItemV2 />, { resources: ['container'] });

    expect(screen.getByText('label.destination')).toBeInTheDocument();
    expect(
      screen.getByText('message.alerts-destination-description')
    ).toBeInTheDocument();
    expect(screen.getByTestId('add-destination-button')).toBeInTheDocument();
  });

  it('renders connection timeout and read timeout inputs', () => {
    renderWithForm(<DestinationFormItemV2 />, { resources: ['container'] });

    expect(
      screen.getByTestId('connection-timeout-input-field')
    ).toBeInTheDocument();
    expect(screen.getByTestId('read-timeout-input-field')).toBeInTheDocument();
  });

  it('disables add button when no resource is selected', () => {
    renderWithForm(<DestinationFormItemV2 />, { resources: [] });

    expect(screen.getByTestId('add-destination-button')).toBeDisabled();
  });

  it('enables add button when a resource is selected', () => {
    renderWithForm(<DestinationFormItemV2 />, { resources: ['container'] });

    expect(screen.getByTestId('add-destination-button')).toBeEnabled();
  });

  it('adds a destination row when add button is clicked', async () => {
    renderWithForm(<DestinationFormItemV2 />, { resources: ['container'] });

    expect(
      screen.queryByTestId('destination-select-item-0')
    ).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('add-destination-button'));
    });

    await waitFor(() => {
      expect(
        screen.getByTestId('destination-select-item-0')
      ).toBeInTheDocument();
    });
  });

  it('removes a destination row when remove is called', async () => {
    renderWithForm(<DestinationFormItemV2 />, { resources: ['container'] });

    await act(async () => {
      fireEvent.click(screen.getByTestId('add-destination-button'));
    });

    await waitFor(() => {
      expect(
        screen.getByTestId('destination-select-item-0')
      ).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('remove-destination-0'));
    });

    await waitFor(() => {
      expect(
        screen.queryByTestId('destination-select-item-0')
      ).not.toBeInTheDocument();
    });
  });

  it('disables test destination button when no external destination is selected', () => {
    renderWithForm(<DestinationFormItemV2 />, {
      resources: ['container'],
      destinations: [
        {
          destinationType: SubscriptionCategory.Owners,
          category: SubscriptionCategory.Owners,
        },
      ],
    });

    expect(screen.getByTestId('test-destination-button')).toBeDisabled();
  });

  it('enables test destination button when external destination is selected', () => {
    renderWithForm(<DestinationFormItemV2 />, {
      resources: ['container'],
      destinations: [
        {
          destinationType: SubscriptionType.Slack,
          category: SubscriptionCategory.External,
          type: SubscriptionType.Slack,
        },
      ],
    });

    expect(screen.getByTestId('test-destination-button')).toBeEnabled();
  });

  it('calls testAlertDestination with formatted external destinations', async () => {
    const formattedDestinations = [
      {
        category: SubscriptionCategory.External,
        type: SubscriptionType.Slack,
        config: { endpoint: 'https://slack.example.com' },
      },
    ];

    mockGetFormattedDestinations.mockReturnValue(formattedDestinations);
    (testAlertDestination as jest.Mock).mockResolvedValue([]);

    renderWithForm(<DestinationFormItemV2 />, {
      resources: ['container'],
      destinations: [
        {
          destinationType: SubscriptionType.Slack,
          category: SubscriptionCategory.External,
          type: SubscriptionType.Slack,
          config: { endpoint: 'https://slack.example.com' },
        },
      ],
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('test-destination-button'));
    });

    await waitFor(() => {
      expect(testAlertDestination).toHaveBeenCalledWith({
        destinations: formattedDestinations,
      });
    });
  });

  it('filters out external destinations with empty config before testing', async () => {
    const formattedDestinations = [
      {
        category: SubscriptionCategory.External,
        type: SubscriptionType.Slack,
        config: { endpoint: 'https://slack.example.com' },
      },
      {
        category: SubscriptionCategory.External,
        type: SubscriptionType.Webhook,
        config: {},
      },
    ];

    mockGetFormattedDestinations.mockReturnValue(formattedDestinations);
    (testAlertDestination as jest.Mock).mockResolvedValue([]);

    renderWithForm(<DestinationFormItemV2 />, {
      resources: ['container'],
      destinations: [
        {
          category: SubscriptionCategory.External,
          type: SubscriptionType.Slack,
        },
        {
          category: SubscriptionCategory.External,
          type: SubscriptionType.Webhook,
        },
      ],
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('test-destination-button'));
    });

    await waitFor(() => {
      expect(testAlertDestination).toHaveBeenCalledWith({
        destinations: [formattedDestinations[0]],
      });
    });
  });

  it('does not call API when getFormattedDestinations returns undefined', async () => {
    mockGetFormattedDestinations.mockReturnValue(undefined);

    renderWithForm(<DestinationFormItemV2 />, {
      resources: ['container'],
      destinations: [
        {
          category: SubscriptionCategory.External,
          type: SubscriptionType.Slack,
        },
      ],
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('test-destination-button'));
    });

    await waitFor(() => {
      expect(mockGetFormattedDestinations).toHaveBeenCalled();
    });

    expect(testAlertDestination).not.toHaveBeenCalled();
  });

  it('shows error toast when testAlertDestination fails', async () => {
    const mockError = new Error('Network error');

    mockGetFormattedDestinations.mockReturnValue([
      {
        category: SubscriptionCategory.External,
        type: SubscriptionType.Slack,
        config: { endpoint: 'https://slack.example.com' },
      },
    ]);
    (testAlertDestination as jest.Mock).mockRejectedValue(mockError);

    renderWithForm(<DestinationFormItemV2 />, {
      resources: ['container'],
      destinations: [
        {
          category: SubscriptionCategory.External,
          type: SubscriptionType.Slack,
        },
      ],
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('test-destination-button'));
    });

    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(mockError);
    });
  });

  it('hides add and test buttons in view mode', () => {
    renderWithForm(<DestinationFormItemV2 isViewMode />, {
      resources: ['container'],
    });

    expect(
      screen.queryByTestId('add-destination-button')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('test-destination-button')
    ).not.toBeInTheDocument();
  });
});
