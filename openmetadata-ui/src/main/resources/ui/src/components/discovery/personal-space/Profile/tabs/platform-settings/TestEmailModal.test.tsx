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
import { testEmailConnection } from '../../../../../../rest/settingConfigAPI';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import TestEmailModal from './TestEmailModal';

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

const onClose = jest.fn();

const typeEmail = (value: string) =>
  fireEvent.change(
    screen.getByTestId('test-email-input').querySelector('input') as Element,
    { target: { value } }
  );

const submit = () =>
  act(async () => {
    fireEvent.click(screen.getByTestId('test-email-submit'));
  });

describe('TestEmailModal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects an invalid address without calling the API', async () => {
    render(<TestEmailModal onClose={onClose} />);
    typeEmail('not-an-email');
    await submit();

    expect(
      await screen.findByText('message.field-text-is-invalid')
    ).toBeInTheDocument();
    expect(testEmailConnection).not.toHaveBeenCalled();
  });

  it('sends a test email and closes', async () => {
    (testEmailConnection as jest.Mock).mockResolvedValue({ data: 'sent' });
    render(<TestEmailModal onClose={onClose} />);
    typeEmail('admin@example.com');
    await submit();

    await waitFor(() =>
      expect(testEmailConnection).toHaveBeenCalledWith({
        email: 'admin@example.com',
      })
    );

    expect(showSuccessToast).toHaveBeenCalledWith('sent');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes after a failed test too, surfacing the error', async () => {
    (testEmailConnection as jest.Mock).mockRejectedValue(new Error('boom'));
    render(<TestEmailModal onClose={onClose} />);
    typeEmail('admin@example.com');
    await submit();

    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());

    expect(onClose).toHaveBeenCalled();
  });
});
