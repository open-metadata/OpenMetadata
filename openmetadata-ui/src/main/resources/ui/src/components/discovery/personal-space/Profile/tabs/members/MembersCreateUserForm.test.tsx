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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createUser } from '../../../../../../rest/userAPI';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import MembersCreateUserForm from './MembersCreateUserForm';

// A stable `t` reference, matching real react-i18next — a fresh one each render
// would make the t-dependent useCallback fetchers (and their effect) re-run in a
// loop.
jest.mock('react-i18next', () => {
  const t = (key: string, params?: Record<string, unknown>) =>
    params ? `${key}${JSON.stringify(params)}` : key;

  return { useTranslation: () => ({ t }) };
});

jest.mock('../../../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({
    authConfig: {},
    setInlineAlertDetails: jest.fn(),
  }),
}));

jest.mock('../../../../../../context/LimitsProvider/useLimitsStore', () => ({
  useLimitStore: () => ({
    getResourceLimit: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock('../../../../../../rest/auth-API', () => ({
  generateRandomPwd: jest.fn().mockResolvedValue('pwd'),
}));
jest.mock('../../../../../../rest/PersonaAPI', () => ({
  getAllPersonas: jest.fn().mockResolvedValue({ data: [] }),
}));
jest.mock('../../../../../../rest/rolesAPIV1', () => ({
  searchRoles: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../../../../../rest/teamsAPI', () => ({
  getTeamsHierarchy: jest.fn().mockResolvedValue({ data: [] }),
}));
jest.mock('../../../../../../rest/userAPI', () => ({
  createUser: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../../../common/DomainSelect/DomainSelect', () => ({
  __esModule: true,
  default: () => <div data-testid="domain-select" />,
}));

jest.mock('../../../../../common/RichTextEditor/RichTextEditor', () => ({
  __esModule: true,
  default: () => <div data-testid="rich-text-editor" />,
}));

describe('MembersCreateUserForm', () => {
  it('renders the create-user form with email field and footer actions', async () => {
    render(<MembersCreateUserForm onNavigate={jest.fn()} />);

    expect(
      await screen.findByTestId('create-user-container')
    ).toBeInTheDocument();
    expect(screen.getByTestId('email')).toBeInTheDocument();
    expect(screen.getByTestId('save-user')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-user')).toBeInTheDocument();
  });

  it('cancels back to the users list for a regular user', async () => {
    const onNavigate = jest.fn();
    render(<MembersCreateUserForm onNavigate={onNavigate} />);

    fireEvent.click(await screen.findByTestId('cancel-user'));

    expect(onNavigate).toHaveBeenCalledWith({ type: 'users' });
  });

  it('cancels back to the admins list and shows the admin toggle when creating an admin', async () => {
    const onNavigate = jest.fn();
    render(<MembersCreateUserForm isAdmin onNavigate={onNavigate} />);

    expect(await screen.findByTestId('admin')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('cancel-user'));

    expect(onNavigate).toHaveBeenCalledWith({ type: 'admins' });
  });

  it('does not emit a create request before the form is submitted', async () => {
    render(<MembersCreateUserForm onNavigate={jest.fn()} />);

    await screen.findByTestId('create-user-container');

    await waitFor(() => expect(createUser).not.toHaveBeenCalled());
  });

  it('submits the create-user payload derived from the email', async () => {
    (createUser as jest.Mock).mockResolvedValueOnce({ id: '1' });
    const onNavigate = jest.fn();
    render(<MembersCreateUserForm onNavigate={onNavigate} />);

    const emailInput = (await screen.findByTestId('email')).querySelector(
      'input'
    ) as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'john@example.com' } });
    fireEvent.click(screen.getByTestId('save-user'));

    await waitFor(() => expect(createUser).toHaveBeenCalled());

    expect((createUser as jest.Mock).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        email: 'john@example.com',
        name: 'john',
        isBot: false,
        isAdmin: false,
      })
    );
  });

  it('sets isAdmin on the payload when creating an admin', async () => {
    (createUser as jest.Mock).mockResolvedValueOnce({ id: '2' });
    render(<MembersCreateUserForm isAdmin onNavigate={jest.fn()} />);

    const emailInput = (await screen.findByTestId('email')).querySelector(
      'input'
    ) as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'boss@example.com' } });
    fireEvent.click(screen.getByTestId('save-user'));

    await waitFor(() => expect(createUser).toHaveBeenCalled());

    expect((createUser as jest.Mock).mock.calls[0][0]).toEqual(
      expect.objectContaining({ email: 'boss@example.com', isAdmin: true })
    );
  });

  it('surfaces an error toast when creation fails (duplicate email)', async () => {
    (createUser as jest.Mock).mockRejectedValueOnce({
      response: { status: 409 },
    });
    render(<MembersCreateUserForm onNavigate={jest.fn()} />);

    const emailInput = (await screen.findByTestId('email')).querySelector(
      'input'
    ) as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'dup@example.com' } });
    fireEvent.click(screen.getByTestId('save-user'));

    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());
  });
});
