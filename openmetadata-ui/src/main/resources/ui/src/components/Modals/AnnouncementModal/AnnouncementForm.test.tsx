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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { DateTime } from 'luxon';
import { useForm } from 'react-hook-form';
import {
  AnnouncementColor,
  AnnouncementType,
} from '../../../generated/entity/feed/announcement';
import AnnouncementForm from './AnnouncementForm.component';
import { toDateInputValue } from './announcementFormUtils';
import { AnnouncementFormValues } from './AnnouncementModal.interface';

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({ t: (key: string) => key }),
}));

// The calendar popover is react-aria's concern; a native date input keeps
// these cases about the form's own value handling.
jest.mock('@openmetadata/ui-core-components', () => {
  const actual = jest.requireActual('@openmetadata/ui-core-components');

  return {
    ...actual,
    DatePicker: ({
      value,
      onChange,
      'aria-label': ariaLabel,
      'data-testid': testId,
    }: {
      value: { toString: () => string } | null;
      onChange: (value: unknown) => void;
      'aria-label'?: string;
      'data-testid'?: string;
    }) => (
      <input
        aria-label={ariaLabel}
        data-testid={testId}
        type="date"
        value={value?.toString() ?? ''}
        onChange={(e) =>
          onChange(e.target.value ? actual.parseDate(e.target.value) : null)
        }
      />
    ),
  };
});

// The block editor is heavy and irrelevant to what this form owns.
jest.mock('../../common/RichTextEditor/RichTextEditor', () => ({
  __esModule: true,
  default: ({
    initialValue,
    onTextChange,
  }: {
    initialValue?: string;
    onTextChange: (value: string) => void;
  }) => (
    <textarea
      aria-label="description"
      data-testid="description"
      value={initialValue}
      onChange={(e) => onTextChange(e.target.value)}
    />
  ),
}));

const START = 1700000000000;
const END = START + 86400000;

const Harness = ({
  onSubmit,
  defaultValues,
}: {
  onSubmit: (values: AnnouncementFormValues) => void;
  defaultValues?: Partial<AnnouncementFormValues>;
}) => {
  const form = useForm<AnnouncementFormValues>({
    // Mirrors both modals: without it `isValid` never updates and the submit
    // button under test would read as permanently disabled.
    mode: 'onChange',
    defaultValues: {
      title: 'A title',
      description: 'Scheduled downtime',
      type: AnnouncementType.Notice,
      startTime: START,
      endTime: END,
      ...defaultValues,
    },
  });

  return (
    <AnnouncementForm
      open
      description="message.add-announcement-description"
      form={form}
      submitLabel="label.submit"
      testId="add-announcement-dialog"
      title="label.add-entity"
      onCancel={jest.fn()}
      onSubmit={onSubmit}
    />
  );
};

describe('AnnouncementForm', () => {
  it('should render the type selector and both date inputs', () => {
    render(<Harness onSubmit={jest.fn()} />);

    // `data-testid` lands on the TextField wrapper; the control itself is the
    // labelled input, which is also what `#title` resolves to in Playwright.
    expect(screen.getByLabelText(/label\.title/)).toHaveValue('A title');
    expect(screen.getByTestId('announcement-type-select')).toBeInTheDocument();
    // Asserted through the same helper so the case is not tied to a timezone.
    expect(screen.getByTestId('startTime')).toHaveValue(
      toDateInputValue(START)
    );
    expect(screen.getByTestId('endTime')).toHaveValue(toDateInputValue(END));
  });

  it('should reveal the colour swatches only for a Custom announcement', () => {
    render(<Harness onSubmit={jest.fn()} />);

    expect(
      screen.queryByTestId('announcement-color-select')
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByTestId(`announcement-type-${AnnouncementType.Custom}`)
    );

    expect(screen.getByTestId('announcement-color-select')).toBeInTheDocument();
  });

  it('should clear the date and block submit when the input is emptied', async () => {
    render(<Harness onSubmit={jest.fn()} />);

    const startInput = screen.getByTestId('startTime');
    await act(async () => {
      fireEvent.change(startInput, { target: { value: '' } });
    });

    // Empty rather than a NaN timestamp, and the form knows it is incomplete.
    expect(startInput).toHaveValue('');
    expect(screen.getByTestId('announcement-submit')).toBeDisabled();
  });

  it('should block submit until a Custom announcement has a colour', async () => {
    const onSubmit = jest.fn();
    render(<Harness onSubmit={onSubmit} />);

    // react-hook-form resolves its first validation asynchronously, so the
    // button starts disabled and settles a tick later.
    await waitFor(() =>
      expect(screen.getByTestId('announcement-submit')).toBeEnabled()
    );

    await act(async () => {
      fireEvent.click(
        screen.getByTestId(`announcement-type-${AnnouncementType.Custom}`)
      );
    });

    // Custom adds a colour and a name requirement, so the form is incomplete
    // again until they are supplied.
    expect(screen.getByTestId('announcement-submit')).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(
        screen.getByTestId(`announcement-color-${AnnouncementColor.Pink}`)
      );
      fireEvent.change(screen.getByLabelText(/label\.custom-name/), {
        target: { value: 'Release' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('announcement-submit'));
    });

    expect(onSubmit.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        type: AnnouncementType.Custom,
        color: AnnouncementColor.Pink,
        customTypeName: 'Release',
      })
    );
  });

  it('should not keep a colour error after switching away from Custom', async () => {
    const onSubmit = jest.fn();
    render(<Harness onSubmit={onSubmit} />);

    await act(async () => {
      fireEvent.click(
        screen.getByTestId(`announcement-type-${AnnouncementType.Custom}`)
      );
    });

    expect(screen.getByTestId('announcement-submit')).toBeDisabled();

    await act(async () => {
      fireEvent.click(
        screen.getByTestId(`announcement-type-${AnnouncementType.Warning}`)
      );
    });

    // Leaving Custom drops its requirements, so the form is submittable again.
    expect(screen.getByTestId('announcement-submit')).toBeEnabled();

    await act(async () => {
      fireEvent.click(screen.getByTestId('announcement-submit'));
    });

    expect(onSubmit.mock.calls[0][0]).toEqual(
      expect.objectContaining({ type: AnnouncementType.Warning })
    );
  });

  it('should offer the types in severity order, not alphabetically', () => {
    render(<Harness onSubmit={jest.fn()} />);

    const rendered = Array.from(
      screen
        .getByTestId('announcement-type-select')
        .querySelectorAll('[data-testid^="announcement-type-"]'),
      (el) => el.getAttribute('data-testid')
    );

    expect(rendered).toEqual(
      [
        AnnouncementType.Critical,
        AnnouncementType.Notice,
        AnnouncementType.Warning,
        AnnouncementType.Deprecation,
        AnnouncementType.Custom,
      ].map((type) => `announcement-type-${type}`)
    );
  });

  it('should expose the types as one radio group, not five toggles', () => {
    render(
      <Harness
        defaultValues={{ type: AnnouncementType.Warning }}
        onSubmit={jest.fn()}
      />
    );

    const group = screen.getByRole('radiogroup', {
      name: 'label.announcement-type',
    });

    // One tab stop with arrow keys between the options, and the selected type
    // announced as "n of 5" — none of which `aria-pressed` buttons provide.
    expect(within(group).getAllByRole('radio')).toHaveLength(5);
    expect(
      within(group).getByRole('radio', { name: 'label.warning' })
    ).toBeChecked();
  });

  it('should show a focus ring on the chip, not on the hidden radio dot', () => {
    render(<Harness onSubmit={jest.fn()} />);

    const chip = screen.getByTestId(
      `announcement-type-${AnnouncementType.Critical}`
    );

    // react-aria only treats focus as "visible" once it has seen a keyboard
    // interaction, so the modality has to be established before focusing.
    act(() => {
      fireEvent.keyDown(document.body, { key: 'Tab' });
      within(chip).getByRole('radio').focus();
    });

    // Core draws the ring on the circular indicator, which this chip hides —
    // so it has to move to the chip itself or keyboard focus is invisible.
    expect(chip).toHaveAttribute('data-focus-visible', 'true');
    expect(chip).toHaveClass('tw:outline-focus-ring');
  });

  it('should reject a Custom name made only of spaces', async () => {
    const onSubmit = jest.fn();
    render(<Harness onSubmit={onSubmit} />);

    await act(async () => {
      fireEvent.click(
        screen.getByTestId(`announcement-type-${AnnouncementType.Custom}`)
      );
    });
    await act(async () => {
      fireEvent.click(
        screen.getByTestId(`announcement-color-${AnnouncementColor.Blue}`)
      );
      fireEvent.change(screen.getByLabelText(/label\.custom-name/), {
        target: { value: '   ' },
      });
    });

    // A name of only spaces is trimmed away on submit, so it must not count.
    expect(screen.getByTestId('announcement-submit')).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('should require a description, judged on content rather than markup', async () => {
    const onSubmit = jest.fn();
    render(
      <Harness defaultValues={{ description: '<p></p>' }} onSubmit={onSubmit} />
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('announcement-submit'));
    });

    // Markup with no content does not satisfy the requirement.
    expect(screen.getByTestId('announcement-submit')).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('should include the chosen end day, so a one-day announcement is possible', async () => {
    const onSubmit = jest.fn();
    render(<Harness onSubmit={onSubmit} />);

    // Same day in both fields — the window must still be non-empty.
    await act(async () => {
      fireEvent.change(screen.getByTestId('startTime'), {
        target: { value: '2026-10-01' },
      });
      fireEvent.change(screen.getByTestId('endTime'), {
        target: { value: '2026-10-01' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('announcement-submit'));
    });

    const { startTime, endTime } = onSubmit.mock.calls[0][0];

    expect(endTime).toBeGreaterThan(startTime);
    // The end is the last instant of the chosen day, not the first.
    expect(DateTime.fromMillis(endTime).toFormat('yyyy-MM-dd HH:mm')).toBe(
      '2026-10-01 23:59'
    );
  });

  it('should offer the five Custom colours, plus a stored one it no longer offers', () => {
    render(
      <Harness
        defaultValues={{
          type: AnnouncementType.Custom,
          color: AnnouncementColor.Purple,
        }}
        onSubmit={jest.fn()}
      />
    );

    const swatches = within(
      screen.getByTestId('announcement-color-select')
    ).getAllByRole('radio');

    // The five the frame offers, then the stored colour kept selectable on edit.
    expect(swatches).toHaveLength(6);
    expect(
      screen.getByTestId(`announcement-color-${AnnouncementColor.Purple}`)
    ).toBeInTheDocument();
    // A radio group, so the stored colour reads as the checked option rather
    // than as one pressed toggle among five unrelated ones. The swatch has no
    // visible text, so its name comes from the colour's own label key.
    expect(
      screen.getByRole('radio', { name: 'label.color-purple' })
    ).toBeChecked();
  });
});
