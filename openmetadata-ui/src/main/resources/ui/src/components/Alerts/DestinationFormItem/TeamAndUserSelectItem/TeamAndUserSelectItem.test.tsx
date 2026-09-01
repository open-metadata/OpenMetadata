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
import { Controller, FormProvider, useForm } from 'react-hook-form';
import TeamAndUserSelectItem from './TeamAndUserSelectItem';
import { TeamAndUserSelectItemProps } from './TeamAndUserSelectItem.interface';

jest.mock('@openmetadata/ui-core-components', () => ({
  ...jest.requireActual('@openmetadata/ui-core-components'),
  Badge: ({
    children,
    'data-testid': tid,
  }: {
    children: ReactNode;
    'data-testid'?: string;
  }) => <span data-testid={tid}>{children}</span>,
  BadgeWithButton: ({
    children,
    onButtonClick,
    'data-testid': tid,
  }: {
    children: ReactNode;
    onButtonClick?: (e: React.MouseEvent) => void;
    'data-testid'?: string;
  }) => (
    <span data-testid={tid}>
      {children}
      <button data-testid={`${tid}-remove`} onClick={onButtonClick}>
        x
      </button>
    </span>
  ),
  Checkbox: ({
    isSelected,
    'data-testid': tid,
  }: {
    isSelected?: boolean;
    'data-testid'?: string;
  }) => (
    <input
      readOnly
      aria-label="Select"
      checked={isSelected ?? false}
      data-testid={tid}
      type="checkbox"
    />
  ),
  Input: ({
    onChange,
    value,
    'data-testid': tid,
    inputDataTestId,
    placeholder,
    autoFocus,
  }: {
    onChange?: (val: string) => void;
    value?: string;
    'data-testid'?: string;
    inputDataTestId?: string;
    placeholder?: string;
    autoFocus?: boolean;
  }) => (
    <input
      aria-label="Search"
      // eslint-disable-next-line jsx-a11y/no-autofocus -- mock forwards the autofocus prop under test
      autoFocus={autoFocus}
      data-testid={inputDataTestId ?? tid}
      placeholder={placeholder}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

const MOCK_OPTIONS = [
  { label: 'Team Alpha', value: 'team-alpha' },
  { label: 'Team Beta', value: 'team-beta' },
];

const MOCK_SEARCHED_OPTIONS = [{ label: 'Team Gamma', value: 'team-gamma' }];

const mockOnSearch = jest
  .fn()
  .mockImplementation((text: string) =>
    Promise.resolve(text ? MOCK_SEARCHED_OPTIONS : MOCK_OPTIONS)
  );

const MOCK_PROPS: TeamAndUserSelectItemProps = {
  entityType: 'team',
  onSearch: mockOnSearch,
  fieldName: [0, 'config', 'receivers'],
  destinationNumber: 0,
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

function renderValidationHarness() {
  function Wrapper() {
    const methods = useForm({
      defaultValues: {
        destinations: [{ config: { receivers: [] } }],
      },
    });

    return (
      <FormProvider {...methods}>
        <form onSubmit={methods.handleSubmit(jest.fn())}>
          <Controller
            control={methods.control}
            name="destinations.0.config.receivers"
            render={({ fieldState }) => (
              <>
                <TeamAndUserSelectItem {...MOCK_PROPS} />
                {fieldState.error?.message}
              </>
            )}
            rules={{ validate: (value) => value.length > 0 || 'required' }}
          />
          <button data-testid="submit" type="submit">
            Submit
          </button>
        </form>
      </FormProvider>
    );
  }

  return render(<Wrapper />);
}

describe('TeamAndUserSelectItem', () => {
  beforeEach(() => {
    jest.useFakeTimers('modern');
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders placeholder when no items are selected', () => {
    renderWithForm(<TeamAndUserSelectItem {...MOCK_PROPS} />);

    expect(screen.getByTestId('placeholder-text')).toBeInTheDocument();
  });

  it('opens dropdown on trigger click', async () => {
    renderWithForm(<TeamAndUserSelectItem {...MOCK_PROPS} />);

    await act(async () => {
      fireEvent.click(
        screen.getByTestId(
          `team-user-select-trigger-${MOCK_PROPS.destinationNumber}`
        )
      );
      jest.advanceTimersByTime(500);
    });

    expect(
      screen.getByTestId(
        `team-user-select-dropdown-${MOCK_PROPS.destinationNumber}`
      )
    ).toBeInTheDocument();
  });

  it('renders the dropdown outside an overflow-constrained container', async () => {
    renderWithForm(
      <div data-testid="overflow-container">
        <TeamAndUserSelectItem {...MOCK_PROPS} />
      </div>
    );

    await act(async () => {
      fireEvent.click(
        screen.getByTestId(
          `team-user-select-trigger-${MOCK_PROPS.destinationNumber}`
        )
      );
      jest.advanceTimersByTime(500);
    });

    expect(screen.getByTestId('overflow-container')).not.toContainElement(
      screen.getByTestId(
        `team-user-select-dropdown-${MOCK_PROPS.destinationNumber}`
      )
    );
  });

  it('does not open the dropdown when disabled', () => {
    renderWithForm(<TeamAndUserSelectItem {...MOCK_PROPS} isDisabled />);

    const trigger = screen.getByTestId(
      `team-user-select-trigger-${MOCK_PROPS.destinationNumber}`
    );
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-disabled', 'true');
    expect(
      screen.queryByTestId(
        `team-user-select-dropdown-${MOCK_PROPS.destinationNumber}`
      )
    ).not.toBeInTheDocument();
  });

  it('loads and shows initial options when dropdown opens', async () => {
    renderWithForm(<TeamAndUserSelectItem {...MOCK_PROPS} />);

    await act(async () => {
      fireEvent.click(
        screen.getByTestId(
          `team-user-select-trigger-${MOCK_PROPS.destinationNumber}`
        )
      );
      jest.advanceTimersByTime(500);
    });

    await waitFor(() => {
      expect(screen.getByTestId('Team Alpha-option-label')).toBeInTheDocument();
      expect(screen.getByTestId('Team Beta-option-label')).toBeInTheDocument();
    });
  });

  it('shows filtered options after typing in search input', async () => {
    renderWithForm(<TeamAndUserSelectItem {...MOCK_PROPS} />);

    await act(async () => {
      fireEvent.click(
        screen.getByTestId(
          `team-user-select-trigger-${MOCK_PROPS.destinationNumber}`
        )
      );
      jest.advanceTimersByTime(500);
    });

    await waitFor(() => {
      expect(screen.getByTestId('search-input-field')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.change(screen.getByTestId('search-input-field'), {
        target: { value: 'gamma' },
      });
      jest.advanceTimersByTime(500);
    });

    await waitFor(() => {
      expect(screen.getByTestId('Team Gamma-option-label')).toBeInTheDocument();
    });
  });

  it('closes dropdown when clicking outside', async () => {
    renderWithForm(<TeamAndUserSelectItem {...MOCK_PROPS} />);

    await act(async () => {
      fireEvent.click(
        screen.getByTestId(
          `team-user-select-trigger-${MOCK_PROPS.destinationNumber}`
        )
      );
      jest.advanceTimersByTime(500);
    });

    expect(
      screen.getByTestId(
        `team-user-select-dropdown-${MOCK_PROPS.destinationNumber}`
      )
    ).toBeInTheDocument();

    await act(async () => {
      fireEvent.pointerDown(document.body);
    });

    expect(
      screen.queryByTestId(
        `team-user-select-dropdown-${MOCK_PROPS.destinationNumber}`
      )
    ).not.toBeInTheDocument();
  });

  it('adds selected option as badge and removes placeholder', async () => {
    renderWithForm(<TeamAndUserSelectItem {...MOCK_PROPS} />);

    await act(async () => {
      fireEvent.click(
        screen.getByTestId(
          `team-user-select-trigger-${MOCK_PROPS.destinationNumber}`
        )
      );
      jest.advanceTimersByTime(500);
    });

    await waitFor(() => {
      expect(screen.getByTestId('team-alpha')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('team-alpha'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('selected-tag-team-alpha')).toBeInTheDocument();
      expect(screen.queryByTestId('placeholder-text')).not.toBeInTheDocument();
    });
  });

  it('clears receiver validation when an option is selected', async () => {
    renderValidationHarness();

    fireEvent.click(screen.getByTestId('submit'));

    expect(await screen.findByText('required')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('team-user-select-trigger-0'));
      jest.advanceTimersByTime(500);
    });
    await waitFor(() =>
      expect(screen.getByTestId('team-alpha')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('team-alpha'));

    await waitFor(() =>
      expect(screen.queryByText('required')).not.toBeInTheDocument()
    );
  });

  it('removes badge on X click', async () => {
    renderWithForm(<TeamAndUserSelectItem {...MOCK_PROPS} />, {
      destinations: [{ config: { receivers: ['team-alpha'] } }],
    });

    expect(screen.getByTestId('selected-tag-team-alpha')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('selected-tag-team-alpha-remove'));
    });

    await waitFor(() => {
      expect(
        screen.queryByTestId('selected-tag-team-alpha')
      ).not.toBeInTheDocument();
      expect(screen.getByTestId('placeholder-text')).toBeInTheDocument();
    });
  });

  it('shows "no data found" message when search returns empty', async () => {
    mockOnSearch.mockResolvedValueOnce([]);

    renderWithForm(<TeamAndUserSelectItem {...MOCK_PROPS} />);

    await act(async () => {
      fireEvent.click(
        screen.getByTestId(
          `team-user-select-trigger-${MOCK_PROPS.destinationNumber}`
        )
      );
      jest.advanceTimersByTime(500);
    });

    await waitFor(() => {
      expect(screen.getByText('label.no-data-found')).toBeInTheDocument();
    });
  });

  it('cancels the pending search when unmounted', () => {
    const { unmount } = renderWithForm(
      <TeamAndUserSelectItem {...MOCK_PROPS} />
    );

    unmount();

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(mockOnSearch).not.toHaveBeenCalled();
  });
});
