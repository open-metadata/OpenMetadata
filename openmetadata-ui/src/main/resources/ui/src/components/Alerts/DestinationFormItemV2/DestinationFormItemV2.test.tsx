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

const ADD_DESTINATION_BUTTON = 'add-destination-button' as const;
const DESTINATION_SELECT_ITEM_0 = 'destination-select-item-0' as const;
const TEST_DESTINATION_BUTTON = 'test-destination-button' as const;
const HTTPS_SLACK_EXAMPLE_COM = 'https://slack.example.com' as const;

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
    // eslint-disable-next-line sonarjs/no-duplicate-string
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
        aria-label={inputDataTestId ?? tid}
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
    expect(screen.getByTestId(ADD_DESTINATION_BUTTON)).toBeInTheDocument();
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

    expect(screen.getByTestId(ADD_DESTINATION_BUTTON)).toBeDisabled();
  });

  it('enables add button when a resource is selected', () => {
    renderWithForm(<DestinationFormItemV2 />, { resources: ['container'] });

    expect(screen.getByTestId(ADD_DESTINATION_BUTTON)).toBeEnabled();
  });

  it('adds a destination row when add button is clicked', async () => {
    renderWithForm(<DestinationFormItemV2 />, { resources: ['container'] });

    expect(
      screen.queryByTestId(DESTINATION_SELECT_ITEM_0)
    ).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId(ADD_DESTINATION_BUTTON));
    });

    await waitFor(() => {
      expect(screen.getByTestId(DESTINATION_SELECT_ITEM_0)).toBeInTheDocument();
    });
  });

  it('removes a destination row when remove is called', async () => {
    renderWithForm(<DestinationFormItemV2 />, { resources: ['container'] });

    await act(async () => {
      fireEvent.click(screen.getByTestId(ADD_DESTINATION_BUTTON));
    });

    await waitFor(() => {
      expect(screen.getByTestId(DESTINATION_SELECT_ITEM_0)).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('remove-destination-0'));
    });

    await waitFor(() => {
      expect(
        screen.queryByTestId(DESTINATION_SELECT_ITEM_0)
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

    expect(screen.getByTestId(TEST_DESTINATION_BUTTON)).toBeDisabled();
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

    expect(screen.getByTestId(TEST_DESTINATION_BUTTON)).toBeEnabled();
  });

  it('calls testAlertDestination with formatted external destinations', async () => {
    const formattedDestinations = [
      {
        category: SubscriptionCategory.External,
        type: SubscriptionType.Slack,
        config: { endpoint: HTTPS_SLACK_EXAMPLE_COM },
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
          config: { endpoint: HTTPS_SLACK_EXAMPLE_COM },
        },
      ],
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId(TEST_DESTINATION_BUTTON));
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
        config: { endpoint: HTTPS_SLACK_EXAMPLE_COM },
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
      fireEvent.click(screen.getByTestId(TEST_DESTINATION_BUTTON));
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
      fireEvent.click(screen.getByTestId(TEST_DESTINATION_BUTTON));
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
        config: { endpoint: HTTPS_SLACK_EXAMPLE_COM },
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
      fireEvent.click(screen.getByTestId(TEST_DESTINATION_BUTTON));
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
      screen.queryByTestId(ADD_DESTINATION_BUTTON)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(TEST_DESTINATION_BUTTON)
    ).not.toBeInTheDocument();
  });
});
