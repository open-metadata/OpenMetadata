/*
 *  Copyright 2023 Collate.
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
import { createUser } from '../../rest/userAPI';
import { getImages } from '../../utils/CommonUtils';
import { mockChangedFormData, mockCreateUser } from './mocks/SignupData.mock';
import SignUp from './SignUpPage';

let letExpectedUserName = {
  name: 'sample123',
  email: 'sample123@sample.com',
};

const mockShowErrorToast = jest.fn();

jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    setIsSigningUp: jest.fn(),
    newUser: {
      name: '',
      email: '',
      picture: '',
    },
  })),
}));

jest.mock(
  '../../components/Settings/Team/TeamsSelectable/TeamsSelectable',
  () => jest.fn().mockImplementation(() => <div>TeamSelectable</div>)
);

jest.mock('../../rest/userAPI', () => ({
  createUser: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockCreateUser)),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn().mockImplementation(() => mockShowErrorToast),
}));

jest.mock('../../utils/CommonUtils', () => ({
  getImages: jest
    .fn()
    .mockResolvedValue(
      'https://lh3.googleusercontent.com/a/ALm5wu0HwEPhAbyRha16cUHrEum-zxTDzj6KZiqYsT5Y=s96-c'
    ),
  Transi18next: jest.fn().mockReturnValue('text'),
}));

jest.mock('../../utils/AuthProvider.util', () => ({
  getNameFromUserData: jest.fn().mockImplementation(() => letExpectedUserName),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockImplementation(() => jest.fn()),
}));

describe('SignUp page', () => {
  it('Component should render properly', async () => {
    (createUser as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ data: {} })
    );
    render(<SignUp />);
    const logo = screen.getByTestId('om-logo');
    const heading = screen.getByTestId('om-heading');
    const form = screen.getByTestId('create-user-form');
    const fullNameLabel = screen.getByTestId('full-name-label');
    const fullNameInput = screen.getByTestId('full-name-input');
    const usernameLabel = screen.getByTestId('username-label');
    const usernameInput = screen.getByTestId('username-input');
    const emailLabel = screen.getByTestId('email-label');
    const emailInput = screen.getByTestId('email-input');
    const selectTeamLabel = screen.getByTestId('select-team-label');
    const createButton = screen.getByTestId('create-button');
    const loadingContent = await screen.queryByTestId('loading-content');
    const submitButton = screen.getByTestId('create-button');

    expect(logo).toBeInTheDocument();
    expect(heading).toBeInTheDocument();
    expect(form).toBeInTheDocument();
    expect(fullNameLabel).toBeInTheDocument();
    expect(fullNameInput).toBeInTheDocument();
    expect(usernameLabel).toBeInTheDocument();
    expect(usernameInput).toBeInTheDocument();
    expect(emailLabel).toBeInTheDocument();
    expect(emailInput).toBeInTheDocument();
    expect(selectTeamLabel).toBeInTheDocument();
    expect(createButton).toBeInTheDocument();
    expect(loadingContent).toBeNull();
    expect(submitButton).toBeInTheDocument();
  });

  it('Handlers in forms for change and submit should work properly', async () => {
    (createUser as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(undefined)
    );

    render(<SignUp />);
    const form = screen.getByTestId('create-user-form');
    const fullNameInput = screen.getByTestId(
      'full-name-input'
    ) as HTMLInputElement;
    const userNameInput = screen.getByTestId(
      'username-input'
    ) as HTMLInputElement;
    const emailInput = screen.getByTestId('email-input') as HTMLInputElement;
    const submitButton = screen.getByTestId('create-button');

    expect(form).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(fullNameInput, {
        target: { name: 'displayName', value: mockChangedFormData.fullName },
      });
      fireEvent.change(userNameInput, {
        target: { name: 'name', value: mockChangedFormData.userName },
      });
      fireEvent.change(emailInput, {
        target: { name: 'email', value: mockChangedFormData.email },
      });
    });

    expect(fullNameInput).toHaveValue(mockChangedFormData.fullName);
    expect(userNameInput).toHaveValue(mockChangedFormData.userName);
    expect(emailInput).toHaveValue(mockChangedFormData.email);

    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(createUser as jest.Mock).toHaveBeenCalledTimes(1);
  });

  it('Error should be thrown if createUser API fails', async () => {
    render(<SignUp />);
    const form = screen.getByTestId('create-user-form');
    const fullNameInput = screen.getByTestId('full-name-input');
    const userNameInput = screen.getByTestId('username-input');
    const emailInput = screen.getByTestId('email-input');
    const submitButton = screen.getByTestId('create-button');

    expect(form).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(fullNameInput, {
        target: { name: 'displayName', value: mockChangedFormData.fullName },
      });
      fireEvent.change(userNameInput, {
        target: { name: 'name', value: mockChangedFormData.userName },
      });
      fireEvent.change(emailInput, {
        target: { name: 'email', value: mockChangedFormData.email },
      });
    });

    expect(fullNameInput).toHaveValue(mockChangedFormData.fullName);
    expect(userNameInput).toHaveValue(mockChangedFormData.userName);
    expect(emailInput).toHaveValue(mockChangedFormData.email);

    fireEvent.click(submitButton);
    await act(async () => {
      (createUser as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({
          response: { data: { message: 'error' } },
        })
      );
    });

    expect(createUser as jest.Mock).toHaveBeenCalledTimes(1);
  });

  it('Handlers in form should work if data is empty', async () => {
    (getImages as jest.Mock).mockImplementationOnce(() => Promise.reject(''));
    letExpectedUserName = { name: '', email: '' };

    render(<SignUp />);
    const form = screen.getByTestId('create-user-form');
    const fullNameInput = screen.getByTestId('full-name-input');
    const usernameInput = screen.getByTestId('username-input');
    const emailInput = screen.getByTestId('email-input');

    expect(form).toBeInTheDocument();
    expect(fullNameInput).toHaveValue('');
    expect(usernameInput).toHaveValue('');
    expect(emailInput).toHaveValue('');

    const submitButton = screen.getByTestId('create-button');
    fireEvent.click(submitButton);

    expect(createUser as jest.Mock).toHaveBeenCalledTimes(0);
  });

  it('should have username as hidden field', async () => {
    render(<SignUp />);

    const usernameInput = screen.getByTestId('username-label');
    usernameInput.parentElement?.parentElement;

    expect(usernameInput.parentElement).toHaveClass('ant-form-item-hidden');
  });
});
