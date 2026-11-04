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
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { testEmailConnection } from '../../../../../../rest/settingConfigAPI';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import TestEmailPopover from './TestEmailPopover';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../../../rest/settingConfigAPI', () => ({
  testEmailConnection: jest.fn(),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const openAndType = async (value: string) => {
  render(<TestEmailPopover />);
  fireEvent.click(screen.getByTestId('test-email-button'));
  fireEvent.change(
    (await screen.findByTestId('test-email-input')).querySelector(
      'input'
    ) as Element,
    { target: { value } }
  );
};

const confirm = () =>
  act(async () => {
    fireEvent.click(screen.getByTestId('test-email-popover-confirm'));
  });

describe('TestEmailPopover', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps the popover open on an invalid address without calling the API', async () => {
    await openAndType('not-an-email');
    await confirm();

    expect(
      await screen.findByText('message.field-text-is-invalid')
    ).toBeInTheDocument();
    expect(screen.getByTestId('test-email-popover')).toBeInTheDocument();
    expect(testEmailConnection).not.toHaveBeenCalled();
  });

  it('sends a test email and closes', async () => {
    (testEmailConnection as jest.Mock).mockResolvedValue({ data: 'sent' });
    await openAndType('admin@example.com');
    await confirm();

    await waitFor(() =>
      expect(testEmailConnection).toHaveBeenCalledWith({
        email: 'admin@example.com',
      })
    );

    expect(showSuccessToast).toHaveBeenCalledWith('sent');

    await waitFor(() =>
      expect(screen.queryByTestId('test-email-popover')).not.toBeInTheDocument()
    );
  });

  it('closes after a failed test too, surfacing the error', async () => {
    (testEmailConnection as jest.Mock).mockRejectedValue(new Error('boom'));
    await openAndType('admin@example.com');
    await confirm();

    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByTestId('test-email-popover')).not.toBeInTheDocument()
    );
  });

  it('sends a test email when Enter is pressed in the address field', async () => {
    (testEmailConnection as jest.Mock).mockResolvedValue({ data: 'sent' });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<TestEmailPopover />);
    fireEvent.click(screen.getByTestId('test-email-button'));
    const input = (await screen.findByTestId('test-email-input')).querySelector(
      'input'
    ) as HTMLInputElement;

    await user.type(input, 'admin@example.com{Enter}');

    await waitFor(() =>
      expect(testEmailConnection).toHaveBeenCalledWith({
        email: 'admin@example.com',
      })
    );
    await waitFor(() =>
      expect(screen.queryByTestId('test-email-popover')).not.toBeInTheDocument()
    );
  });

  it('keeps the popover open when Enter is pressed on an invalid address', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<TestEmailPopover />);
    fireEvent.click(screen.getByTestId('test-email-button'));
    const input = (await screen.findByTestId('test-email-input')).querySelector(
      'input'
    ) as HTMLInputElement;

    await user.type(input, 'not-an-email{Enter}');

    expect(
      await screen.findByText('message.field-text-is-invalid')
    ).toBeInTheDocument();
    expect(screen.getByTestId('test-email-popover')).toBeInTheDocument();
    expect(testEmailConnection).not.toHaveBeenCalled();
  });

  it('sends nothing when cancelled', async () => {
    await openAndType('admin@example.com');
    fireEvent.click(screen.getByTestId('test-email-popover-cancel'));

    await waitFor(() =>
      expect(screen.queryByTestId('test-email-popover')).not.toBeInTheDocument()
    );

    expect(testEmailConnection).not.toHaveBeenCalled();
  });
});
