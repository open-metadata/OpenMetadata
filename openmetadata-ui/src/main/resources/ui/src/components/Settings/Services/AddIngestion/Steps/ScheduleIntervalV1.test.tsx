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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { SchedularOptions } from '../../../../../enums/Schedular.enum';
import ScheduleIntervalV1 from './ScheduleIntervalV1';

const CRON_CONTAINER = 'cron-container';
const FREQUENCY_DAY = 'frequency-day';
const DATA_SELECTED = 'data-selected';
const TIME_PICKER = 'time-picker';
const DAY_OPTIONS = 'day-options';
const DATE_OPTIONS = 'date-options';
const MINUTE_OPTIONS = 'minute-options';
const FREQUENCY_WEEK = 'frequency-week';
const STR_0_9_18 = '0 9,18 * * *';
const CUSTOM_CRON_INPUT = 'custom-cron-input';
const STR_5 = '*/5 * * * *';
const CUSTOM_CRON_ERROR = 'custom-cron-error';

jest.mock('../../../../../utils/i18next/i18nextUtil', () => ({
  getCurrentLocaleForConstrue: jest.fn().mockReturnValue('en-US'),
}));

jest.mock('cronstrue/i18n', () => ({
  __esModule: true,
  default: {
    toString: jest.fn().mockReturnValue('every day human text'),
  },
}));

jest.mock('@untitledui/icons', () => ({
  Clock: () => <span data-testid="clock-icon" />,
}));

jest.mock('./ScheduleSelectionCards', () => ({
  __esModule: true,
  default: ({
    options,
    value,
    onChange,
    disabled,
  }: {
    options: { value: string; label: string }[];
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
  }) => (
    <div data-testid="selection-card-group">
      {options.map((option) => (
        <button
          data-active={value === option.value}
          data-testid={`schedular-${option.value}`}
          disabled={disabled}
          key={option.value}
          type="button"
          onClick={() => !disabled && onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  ),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: ({
    children,
    color,
    isDisabled,
    onPress,
    className,
    ...rest
  }: {
    children: React.ReactNode;
    color?: string;
    isDisabled?: boolean;
    onPress?: () => void;
    className?: string;
  } & Record<string, unknown>) => (
    <button
      data-color={color}
      data-selected={className ? 'true' : 'false'}
      data-testid={rest['data-testid'] as string}
      disabled={isDisabled}
      type="button"
      onClick={() => onPress?.()}>
      {children}
    </button>
  ),
  Card: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div className={className} data-testid="cron-expression-card">
      {children}
    </div>
  ),
  Grid: Object.assign(
    ({ children, ...rest }: Record<string, unknown>) => (
      <div data-testid={rest['data-testid'] as string}>
        {children as React.ReactNode}
      </div>
    ),
    {
      Item: ({ children, ...rest }: Record<string, unknown>) => (
        <div data-testid={rest['data-testid'] as string}>
          {children as React.ReactNode}
        </div>
      ),
    }
  ),
  Select: Object.assign(
    ({
      items,
      selectedKey,
      onSelectionChange,
      isDisabled,
      ...rest
    }: {
      items?: { id: string; label: string }[];
      selectedKey?: string | null;
      onSelectionChange?: (key: string) => void;
      isDisabled?: boolean;
    } & Record<string, unknown>) => (
      <select
        aria-label={rest['aria-label'] as string}
        data-testid={rest['data-testid'] as string}
        disabled={isDisabled}
        value={selectedKey ?? ''}
        onChange={(event) => onSelectionChange?.(event.target.value)}>
        {(items ?? []).map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    ),
    {
      Item: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    }
  ),
  TimePicker: ({
    value,
    onChange,
    isDisabled,
    ...rest
  }: {
    value?: { hour: number; minute: number } | null;
    onChange?: (value: { hour: number; minute: number } | null) => void;
    isDisabled?: boolean;
  } & Record<string, unknown>) => (
    <input
      aria-label={rest['aria-label'] as string}
      data-testid={rest['data-testid'] as string}
      disabled={isDisabled}
      value={value ? `${value.hour}:${value.minute}` : ''}
      onChange={(event) => {
        const [hour, minute] = event.target.value.split(':');
        onChange?.({ hour: Number(hour), minute: Number(minute) });
      }}
    />
  ),
  Input: ({
    value,
    onChange,
    isDisabled,
    placeholder,
    ...rest
  }: {
    value?: string;
    onChange?: (value: string) => void;
    isDisabled?: boolean;
    placeholder?: string;
  } & Record<string, unknown>) => (
    <input
      aria-label={rest['aria-label'] as string}
      data-testid={rest['data-testid'] as string}
      disabled={isDisabled}
      placeholder={placeholder}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
  Typography: ({
    children,
    className,
    ...rest
  }: {
    children: React.ReactNode;
    className?: string;
  } & Record<string, unknown>) => (
    <span className={className} data-testid={rest['data-testid'] as string}>
      {children}
    </span>
  ),
}));

const renderComponent = (props = {}) =>
  act(async () => {
    render(<ScheduleIntervalV1 {...props} />);
  });

const renderControlled = (
  initialValue: string | undefined = '',
  extraProps: Record<string, unknown> = {}
) => {
  const onChange = jest.fn();

  const Wrapper = () => {
    const [value, setValue] = useState<string | undefined>(initialValue);

    return (
      <ScheduleIntervalV1
        {...extraProps}
        value={value}
        onChange={(next) => {
          onChange(next);
          setValue(next);
        }}
      />
    );
  };

  const utils = render(<Wrapper />);

  return { onChange, ...utils };
};

describe('ScheduleIntervalV1', () => {
  it('should render in on-demand mode when value is empty', async () => {
    await renderComponent({ value: '' });

    expect(screen.getByTestId('selection-card-group')).toBeInTheDocument();
    expect(screen.queryByTestId(CRON_CONTAINER)).not.toBeInTheDocument();
    expect(
      screen.getByText('message.pipeline-will-trigger-manually')
    ).toBeInTheDocument();
  });

  it('should mark the on-demand card as active when value is empty', async () => {
    await renderComponent({ value: '' });

    expect(
      screen.getByTestId(`schedular-${SchedularOptions.ON_DEMAND}`)
    ).toHaveAttribute('data-active', 'true');
    expect(
      screen.getByTestId(`schedular-${SchedularOptions.SCHEDULE}`)
    ).toHaveAttribute('data-active', 'false');
  });

  it('should switch to schedule mode and emit the default daily cron', async () => {
    const { onChange } = renderControlled('');

    await act(async () => {
      fireEvent.click(
        screen.getByTestId(`schedular-${SchedularOptions.SCHEDULE}`)
      );
    });

    expect(onChange).toHaveBeenCalledWith('0 0 * * *');
    expect(screen.getByTestId(CRON_CONTAINER)).toBeInTheDocument();
    expect(screen.getByTestId(FREQUENCY_DAY)).toHaveAttribute(
      DATA_SELECTED,
      'true'
    );
    expect(screen.getByTestId(TIME_PICKER)).toBeInTheDocument();
  });

  it('should emit undefined when switching back to on-demand', async () => {
    const { onChange } = renderControlled('0 0 * * *');

    await act(async () => {
      fireEvent.click(
        screen.getByTestId(`schedular-${SchedularOptions.ON_DEMAND}`)
      );
    });

    expect(onChange).toHaveBeenCalledWith(undefined);
    expect(screen.queryByTestId(CRON_CONTAINER)).not.toBeInTheDocument();
  });

  it('should render only the time picker for a daily cron value', async () => {
    await renderComponent({ value: '0 0 * * *' });

    expect(screen.getByTestId(FREQUENCY_DAY)).toHaveAttribute(
      DATA_SELECTED,
      'true'
    );
    expect(screen.getByTestId(TIME_PICKER)).toHaveValue('0:0');
    expect(screen.queryByTestId(DAY_OPTIONS)).not.toBeInTheDocument();
    expect(screen.queryByTestId(DATE_OPTIONS)).not.toBeInTheDocument();
    expect(screen.queryByTestId(MINUTE_OPTIONS)).not.toBeInTheDocument();
  });

  it('should emit a new cron when the time picker changes (daily)', async () => {
    const { onChange } = renderControlled('0 0 * * *');

    await act(async () => {
      fireEvent.change(screen.getByTestId(TIME_PICKER), {
        target: { value: '5:30' },
      });
    });

    expect(onChange).toHaveBeenCalledWith('30 5 * * *');
    expect(screen.getByTestId(TIME_PICKER)).toHaveValue('5:30');
  });

  it('should switch to an hourly frequency and show only the minute select', async () => {
    const { onChange } = renderControlled('0 0 * * *');

    await act(async () => {
      fireEvent.click(screen.getByTestId('frequency-hour'));
    });

    expect(onChange).toHaveBeenCalledWith('0 * * * *');
    expect(screen.getByTestId(MINUTE_OPTIONS)).toBeInTheDocument();
    expect(screen.queryByTestId(TIME_PICKER)).not.toBeInTheDocument();
  });

  it('should emit a new cron when the minute select changes (hourly)', async () => {
    const { onChange } = renderControlled('0 * * * *');

    await act(async () => {
      fireEvent.change(screen.getByTestId(MINUTE_OPTIONS), {
        target: { value: '15' },
      });
    });

    expect(onChange).toHaveBeenCalledWith('15 * * * *');
    expect(screen.getByTestId(MINUTE_OPTIONS)).toHaveValue('15');
  });

  it('should render a day select for a weekly cron and highlight the selected frequency', async () => {
    await renderComponent({ value: '0 0 * * 1' });

    expect(screen.getByTestId(FREQUENCY_WEEK)).toHaveAttribute(
      DATA_SELECTED,
      'true'
    );
    expect(screen.getByTestId(DAY_OPTIONS)).toHaveValue('1');
    expect(screen.getByTestId(TIME_PICKER)).toBeInTheDocument();
  });

  it('should emit a new cron when the day select changes (weekly)', async () => {
    const { onChange } = renderControlled('0 0 * * 1');

    await act(async () => {
      fireEvent.change(screen.getByTestId(DAY_OPTIONS), {
        target: { value: '3' },
      });
    });

    expect(onChange).toHaveBeenCalledWith('0 0 * * 3');
    expect(screen.getByTestId(DAY_OPTIONS)).toHaveValue('3');
  });

  it('should emit a new cron when the time picker changes (weekly)', async () => {
    const { onChange } = renderControlled('0 0 * * 1');

    await act(async () => {
      fireEvent.change(screen.getByTestId(TIME_PICKER), {
        target: { value: '5:30' },
      });
    });

    expect(onChange).toHaveBeenCalledWith('30 5 * * 1');
  });

  it('should render a date select for a monthly cron and emit on change', async () => {
    const { onChange } = renderControlled('0 0 1 * *');

    expect(screen.getByTestId('frequency-month')).toHaveAttribute(
      DATA_SELECTED,
      'true'
    );
    expect(screen.getByTestId(DATE_OPTIONS)).toHaveValue('1');

    await act(async () => {
      fireEvent.change(screen.getByTestId(DATE_OPTIONS), {
        target: { value: '5' },
      });
    });

    expect(onChange).toHaveBeenCalledWith('0 0 5 * *');
    expect(screen.getByTestId(DATE_OPTIONS)).toHaveValue('5');
  });

  it('should switch frequency from daily to weekly', async () => {
    const { onChange } = renderControlled('0 0 * * *');

    await act(async () => {
      fireEvent.click(screen.getByTestId(FREQUENCY_WEEK));
    });

    expect(onChange).toHaveBeenCalledWith('0 0 * * 1');
    expect(screen.getByTestId(DAY_OPTIONS)).toBeInTheDocument();
  });

  it('should render the custom frequency option', async () => {
    await renderComponent({ value: '0 0 * * *' });

    expect(screen.getByTestId('frequency-custom')).toBeInTheDocument();
  });

  it('should show the custom cron input when value is a custom cron', async () => {
    await renderComponent({ value: STR_0_9_18 });

    expect(screen.getByTestId(CUSTOM_CRON_INPUT)).toBeInTheDocument();
    expect(screen.queryByTestId(TIME_PICKER)).not.toBeInTheDocument();
    expect(screen.queryByTestId(MINUTE_OPTIONS)).not.toBeInTheDocument();
    expect(screen.getByTestId('frequency-custom')).toHaveAttribute(
      DATA_SELECTED,
      'true'
    );
  });

  it('should emit the custom cron value when typed', async () => {
    const { onChange } = renderControlled(STR_0_9_18);

    onChange.mockClear();

    await act(async () => {
      fireEvent.change(screen.getByTestId(CUSTOM_CRON_INPUT), {
        target: { value: STR_5 },
      });
    });

    expect(onChange).toHaveBeenCalledWith(STR_5);
  });

  it('should show validation error for invalid cron syntax and not call onChange', async () => {
    const { onChange } = renderControlled(STR_5);

    onChange.mockClear();

    await act(async () => {
      fireEvent.change(screen.getByTestId(CUSTOM_CRON_INPUT), {
        target: { value: 'bad cron' },
      });
    });

    expect(screen.getByTestId(CUSTOM_CRON_ERROR)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should clear validation error when valid cron is entered', async () => {
    await renderComponent({ value: STR_5 });

    await act(async () => {
      fireEvent.change(screen.getByTestId(CUSTOM_CRON_INPUT), {
        target: { value: 'bad' },
      });
    });

    expect(screen.getByTestId(CUSTOM_CRON_ERROR)).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(screen.getByTestId(CUSTOM_CRON_INPUT), {
        target: { value: '0 */2 * * *' },
      });
    });

    expect(screen.queryByTestId(CUSTOM_CRON_ERROR)).not.toBeInTheDocument();
  });

  it('should switch from custom back to a preset frequency', async () => {
    const { onChange } = renderControlled(STR_0_9_18);

    expect(screen.getByTestId(CUSTOM_CRON_INPUT)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId(FREQUENCY_DAY));
    });

    expect(screen.queryByTestId(CUSTOM_CRON_INPUT)).not.toBeInTheDocument();
    expect(screen.getByTestId(TIME_PICKER)).toBeInTheDocument();
    expect(onChange).toHaveBeenCalled();
  });

  it('should disable the custom cron input when disabled is true', async () => {
    await renderComponent({ value: STR_0_9_18, disabled: true });

    expect(screen.getByTestId(CUSTOM_CRON_INPUT)).toBeDisabled();
  });

  it('should disable all controls when disabled is true', async () => {
    await renderComponent({ value: '0 0 * * 1', disabled: true });

    expect(screen.getByTestId(FREQUENCY_WEEK)).toBeDisabled();
    expect(screen.getByTestId(DAY_OPTIONS)).toBeDisabled();
    expect(screen.getByTestId(TIME_PICKER)).toBeDisabled();
  });

  it('should not switch schedular when disabled', async () => {
    const onChange = jest.fn();
    await renderComponent({ value: '0 0 * * *', disabled: true, onChange });

    await act(async () => {
      fireEvent.click(
        screen.getByTestId(`schedular-${SchedularOptions.ON_DEMAND}`)
      );
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('should sync internal state when the external value changes', async () => {
    const { rerender } = render(<ScheduleIntervalV1 value="" />);

    expect(screen.queryByTestId(CRON_CONTAINER)).not.toBeInTheDocument();

    await act(async () => {
      rerender(<ScheduleIntervalV1 value="0 0 * * 1" />);
    });

    expect(screen.getByTestId(CRON_CONTAINER)).toBeInTheDocument();
    expect(screen.getByTestId(FREQUENCY_WEEK)).toHaveAttribute(
      DATA_SELECTED,
      'true'
    );
    expect(screen.getByTestId(DAY_OPTIONS)).toHaveValue('1');
  });

  it('should render the human readable cron text when scheduled', async () => {
    await renderComponent({ value: '0 0 * * *' });

    expect(
      screen.getByText('label.entity-scheduled-to-run-value')
    ).toBeInTheDocument();
  });
});
