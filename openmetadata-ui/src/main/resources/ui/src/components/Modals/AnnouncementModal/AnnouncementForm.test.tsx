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

import { act, fireEvent, render, screen } from '@testing-library/react';
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

jest.mock('../../../utils/date-time/DateTimeUtils', () => ({
  getTimeZone: () => 'UTC',
}));

// The rich-text description field pulls the block editor, which is irrelevant
// to what this form owns.
jest.mock('@openmetadata/ui-core-components', () => ({
  ...jest.requireActual('@openmetadata/ui-core-components'),
  getField: ({ name }: { name: string }) => (
    <div data-testid={`field-${name}`} />
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
    defaultValues: {
      title: 'A title',
      description: '',
      announcementType: AnnouncementType.Notice,
      startTime: START,
      endTime: END,
      ...defaultValues,
    },
  });

  return (
    <AnnouncementForm
      open
      form={form}
      submitLabel="label.submit"
      testId="add-announcement"
      title="message.make-an-announcement"
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

  it('should keep the previous date when the input is cleared', () => {
    render(<Harness onSubmit={jest.fn()} />);

    const startInput = screen.getByTestId('startTime');
    fireEvent.change(startInput, { target: { value: '' } });

    // An empty input must not write a NaN timestamp into the form.
    expect(startInput).toHaveValue(toDateInputValue(START));
  });

  it('should block submit until a Custom announcement has a colour', async () => {
    const onSubmit = jest.fn();
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.click(
      screen.getByTestId(`announcement-type-${AnnouncementType.Custom}`)
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('announcement-submit'));
    });

    expect(screen.getByTestId('color-error')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(
        screen.getByTestId(`announcement-color-${AnnouncementColor.Pink}`)
      );
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('announcement-submit'));
    });

    expect(onSubmit.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        announcementType: AnnouncementType.Custom,
        color: AnnouncementColor.Pink,
      })
    );
  });

  it('should not keep a colour error after switching away from Custom', async () => {
    const onSubmit = jest.fn();
    render(<Harness onSubmit={onSubmit} />);

    fireEvent.click(
      screen.getByTestId(`announcement-type-${AnnouncementType.Custom}`)
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('announcement-submit'));
    });

    expect(screen.getByTestId('color-error')).toBeInTheDocument();

    fireEvent.click(
      screen.getByTestId(`announcement-type-${AnnouncementType.Warning}`)
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('announcement-submit'));
    });

    expect(onSubmit.mock.calls[0][0]).toEqual(
      expect.objectContaining({ announcementType: AnnouncementType.Warning })
    );
  });
});
