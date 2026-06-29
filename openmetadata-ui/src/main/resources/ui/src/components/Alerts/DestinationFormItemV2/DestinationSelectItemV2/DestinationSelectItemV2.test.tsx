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
  Status,
  SubscriptionCategory,
  SubscriptionType,
} from '../../../../generated/events/eventSubscription';
import DestinationSelectItemV2 from './DestinationSelectItemV2';
import { DestinationSelectItemV2Props } from './DestinationSelectItemV2.interface';

jest.mock('@openmetadata/ui-core-components', () => {
  const SelectItem = ({
    id,
    children,
  }: {
    id: string;
    children?: ReactNode;
  }) => <option value={id}>{children}</option>;

  const ComboBox = ({
    onSelectionChange,
    selectedKey,
    items = [],
    'data-testid': tid,
  }: {
    onSelectionChange?: (key: string) => void;
    selectedKey?: string | null;
    items?: { id: string; label?: string; isDisabled?: boolean }[];
    'data-testid'?: string;
  }) => (
    <select
      data-testid={tid}
      value={selectedKey ?? ''}
      onChange={(e) => onSelectionChange?.(e.target.value)}>
      <option value="" />
      {items.map((item) => (
        <option disabled={item.isDisabled} key={item.id} value={item.id}>
          {item.label}
        </option>
      ))}
    </select>
  );

  const SelectBase = ({
    onSelectionChange,
    selectedKey,
    children,
    'data-testid': tid,
    isRequired,
    placeholder,
  }: {
    onSelectionChange?: (key: string) => void;
    selectedKey?: string | null;
    children?: ReactNode;
    'data-testid'?: string;
    isRequired?: boolean;
    placeholder?: string;
  }) => (
    <select
      data-testid={tid}
      required={isRequired}
      value={selectedKey ?? ''}
      onChange={(e) => onSelectionChange?.(e.target.value)}>
      {placeholder && <option value="">{placeholder}</option>}
      {children}
    </select>
  );

  SelectBase.Item = SelectItem;
  SelectBase.ComboBox = ComboBox;

  const GridItem = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  const Grid = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );

  Grid.Item = GridItem;

  return {
    Alert: ({ title, variant }: { title: ReactNode; variant?: string }) => (
      <div data-testid={`alert-${variant}`}>{title}</div>
    ),
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
    Grid,
    Input: ({
      onChange,
      value,
      'data-testid': tid,
      inputDataTestId,
      label,
      defaultValue,
    }: {
      onChange?: (val: string) => void;
      value?: string;
      'data-testid'?: string;
      inputDataTestId?: string;
      label?: ReactNode;
      defaultValue?: string;
    }) => (
      <div>
        {label && <label>{label}</label>}
        <input
          data-testid={inputDataTestId ?? tid}
          defaultValue={defaultValue}
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value)}
        />
      </div>
    ),
    Select: SelectBase,
    Toggle: ({
      onChange,
      isSelected,
      label,
    }: {
      onChange?: (checked: boolean) => void;
      isSelected?: boolean;
      label?: ReactNode;
    }) => (
      <label>
        <input
          checked={isSelected ?? false}
          data-testid="notify-downstream-toggle"
          type="checkbox"
          onChange={(e) => onChange?.(e.target.checked)}
        />
        {label}
      </label>
    ),
  };
});

jest.mock('@untitledui/icons', () => ({
  X: () => <span>X</span>,
}));

jest.mock('../../../../utils/ObservabilityUtils', () => ({
  checkIfDestinationIsInternal: jest
    .fn()
    .mockImplementation((value: string) =>
      ['Owners', 'Followers', 'Admins', 'Teams', 'Users'].includes(value)
    ),
  getConfigFieldFromDestinationType: jest.fn().mockReturnValue(null),
  getAlertDestinationCategoryIcons: jest.fn().mockReturnValue(null),
}));

jest.mock('../../../../utils/Alerts/AlertsUtil', () => ({
  getDestinationStatusAlertData: jest.fn().mockReturnValue({
    statusLabel: 'Success',
    alertClassName: '',
    alertIcon: null,
  }),
}));

jest.mock('../../../../utils/Alerts/AlertsUtilPure', () => ({
  getSubscriptionTypeOptions: jest.fn().mockReturnValue([
    { value: 'ActivityFeed', disabled: false },
    { value: 'Email', disabled: false },
  ]),
  normalizeDestinationConfig: jest.fn().mockImplementation((c) => c),
}));

jest.mock('./DestinationConfigField/DestinationConfigField', () =>
  jest
    .fn()
    .mockImplementation(() => <div data-testid="destination-config-field" />)
);

const MOCK_PROPS: DestinationSelectItemV2Props = {
  selectorKey: 0,
  id: 0,
  remove: jest.fn(),
  isDestinationStatusLoading: false,
};

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

describe('DestinationSelectItemV2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the destination category combobox', () => {
    renderWithForm(<DestinationSelectItemV2 {...MOCK_PROPS} />);

    expect(
      screen.getByTestId(`destination-category-select-${MOCK_PROPS.id}`)
    ).toBeInTheDocument();
  });

  it('renders remove button and calls remove on click', async () => {
    renderWithForm(<DestinationSelectItemV2 {...MOCK_PROPS} />);

    const removeBtn = screen.getByTestId(`remove-destination-${MOCK_PROPS.id}`);

    await act(async () => {
      fireEvent.click(removeBtn);
    });

    expect(MOCK_PROPS.remove).toHaveBeenCalledWith(MOCK_PROPS.id);
  });

  it('hides remove button in view mode', () => {
    renderWithForm(<DestinationSelectItemV2 {...MOCK_PROPS} isViewMode />);

    expect(
      screen.queryByTestId(`remove-destination-${MOCK_PROPS.id}`)
    ).not.toBeInTheDocument();
  });

  it('shows config field when external destination is selected', async () => {
    renderWithForm(<DestinationSelectItemV2 {...MOCK_PROPS} />, {
      destinations: [{ destinationType: SubscriptionType.Slack }],
    });

    await waitFor(() => {
      expect(
        screen.getByTestId('destination-config-field')
      ).toBeInTheDocument();
    });
  });

  it('shows internal type select when internal destination is selected', async () => {
    renderWithForm(<DestinationSelectItemV2 {...MOCK_PROPS} />, {
      destinations: [{ destinationType: SubscriptionCategory.Owners }],
    });

    await waitFor(() => {
      expect(
        screen.getByTestId(`destination-type-select-${MOCK_PROPS.id}`)
      ).toBeInTheDocument();
    });
  });

  it('shows owner-selection warning for Owners with non-Email subscription type', async () => {
    renderWithForm(<DestinationSelectItemV2 {...MOCK_PROPS} />, {
      destinations: [
        {
          destinationType: SubscriptionCategory.Owners,
          type: SubscriptionType.ActivityFeed,
        },
      ],
    });

    await waitFor(() => {
      expect(
        screen.getByText('message.destination-owner-selection-warning')
      ).toBeInTheDocument();
    });
  });

  it('shows generic selection warning for Owners with Email subscription type', async () => {
    renderWithForm(<DestinationSelectItemV2 {...MOCK_PROPS} />, {
      destinations: [
        {
          destinationType: SubscriptionCategory.Owners,
          type: SubscriptionType.Email,
        },
      ],
    });

    await waitFor(() => {
      expect(
        screen.getByText('message.destination-selection-warning')
      ).toBeInTheDocument();
    });
  });

  it('shows generic selection warning for non-Owners internal destination', async () => {
    renderWithForm(<DestinationSelectItemV2 {...MOCK_PROPS} />, {
      destinations: [
        {
          destinationType: SubscriptionCategory.Admins,
          type: SubscriptionType.Email,
        },
      ],
    });

    await waitFor(() => {
      expect(
        screen.getByText('message.destination-selection-warning')
      ).toBeInTheDocument();
    });
  });

  it('shows notify downstream toggle when a destination is selected', async () => {
    renderWithForm(<DestinationSelectItemV2 {...MOCK_PROPS} />, {
      destinations: [
        {
          destinationType: SubscriptionType.Slack,
          category: SubscriptionCategory.External,
        },
      ],
    });

    await waitFor(() => {
      expect(screen.getByText('label.notify-downstream')).toBeInTheDocument();
    });
  });

  it('shows downstream depth input when notify downstream is enabled', async () => {
    renderWithForm(<DestinationSelectItemV2 {...MOCK_PROPS} />, {
      destinations: [
        {
          destinationType: SubscriptionType.Slack,
          notifyDownstream: true,
        },
      ],
    });

    await waitFor(() => {
      expect(
        screen.getByTestId(
          `destination-downstream-depth-input-${MOCK_PROPS.id}`
        )
      ).toBeInTheDocument();
    });
  });

  it('hides downstream depth input when notify downstream is disabled', async () => {
    renderWithForm(<DestinationSelectItemV2 {...MOCK_PROPS} />, {
      destinations: [
        {
          destinationType: SubscriptionType.Slack,
          notifyDownstream: false,
        },
      ],
    });

    await waitFor(() => {
      expect(
        screen.queryByTestId(
          `destination-downstream-depth-input-${MOCK_PROPS.id}`
        )
      ).not.toBeInTheDocument();
    });
  });

  it('shows success status alert when destination status matches', async () => {
    const destinationsWithStatus = [
      {
        type: SubscriptionType.Slack,
        category: SubscriptionCategory.External,
        config: { endpoint: 'https://hooks.slack.com' },
        statusDetails: {
          status: Status.Success,
          statusCode: 200,
          reason: 'OK',
        },
      },
    ];

    renderWithForm(
      <DestinationSelectItemV2
        {...MOCK_PROPS}
        destinationsWithStatus={destinationsWithStatus}
      />,
      {
        destinations: [
          {
            type: SubscriptionType.Slack,
            category: SubscriptionCategory.External,
            config: { endpoint: 'https://hooks.slack.com' },
          },
        ],
      }
    );

    await waitFor(() => {
      expect(screen.getByTestId('alert-success')).toBeInTheDocument();
    });
  });

  it('shows loading skeleton when destination status is loading', async () => {
    renderWithForm(
      <DestinationSelectItemV2 {...MOCK_PROPS} isDestinationStatusLoading />,
      {
        destinations: [
          {
            destinationType: SubscriptionType.Slack,
            category: SubscriptionCategory.External,
          },
        ],
      }
    );

    await waitFor(() => {
      expect(document.querySelector('.tw\\:animate-pulse')).toBeInTheDocument();
    });
  });

  it('shows config field when category is changed via combobox', async () => {
    renderWithForm(<DestinationSelectItemV2 {...MOCK_PROPS} />);

    const comboBox = screen.getByTestId(
      `destination-category-select-${MOCK_PROPS.id}`
    );

    await act(async () => {
      fireEvent.change(comboBox, { target: { value: SubscriptionType.Slack } });
    });

    await waitFor(() => {
      expect(
        screen.getByTestId('destination-config-field')
      ).toBeInTheDocument();
    });
  });
});
