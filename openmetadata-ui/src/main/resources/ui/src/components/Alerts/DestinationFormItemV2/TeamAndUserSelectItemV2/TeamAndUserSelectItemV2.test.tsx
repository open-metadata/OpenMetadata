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
import TeamAndUserSelectItemV2 from './TeamAndUserSelectItemV2';
import { TeamAndUserSelectItemV2Props } from './TeamAndUserSelectItemV2.interface';

jest.mock('@openmetadata/ui-core-components', () => ({
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

const MOCK_PROPS: TeamAndUserSelectItemV2Props = {
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

describe('TeamAndUserSelectItemV2', () => {
  beforeEach(() => {
    jest.useFakeTimers('modern');
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders placeholder when no items are selected', () => {
    renderWithForm(<TeamAndUserSelectItemV2 {...MOCK_PROPS} />);

    expect(screen.getByTestId('placeholder-text')).toBeInTheDocument();
  });

  it('opens dropdown on trigger click', async () => {
    renderWithForm(<TeamAndUserSelectItemV2 {...MOCK_PROPS} />);

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

  it('loads and shows initial options when dropdown opens', async () => {
    renderWithForm(<TeamAndUserSelectItemV2 {...MOCK_PROPS} />);

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
    renderWithForm(<TeamAndUserSelectItemV2 {...MOCK_PROPS} />);

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
    renderWithForm(<TeamAndUserSelectItemV2 {...MOCK_PROPS} />);

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
      fireEvent.click(document.body);
    });

    expect(
      screen.queryByTestId(
        `team-user-select-dropdown-${MOCK_PROPS.destinationNumber}`
      )
    ).not.toBeInTheDocument();
  });

  it('adds selected option as badge and removes placeholder', async () => {
    renderWithForm(<TeamAndUserSelectItemV2 {...MOCK_PROPS} />);

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

  it('removes badge on X click', async () => {
    renderWithForm(<TeamAndUserSelectItemV2 {...MOCK_PROPS} />, {
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

    renderWithForm(<TeamAndUserSelectItemV2 {...MOCK_PROPS} />);

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
});
