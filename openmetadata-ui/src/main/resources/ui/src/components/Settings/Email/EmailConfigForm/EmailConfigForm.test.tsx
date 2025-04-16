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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { TransportationStrategy } from '../../../../generated/email/smtpSettings';
import EmailConfigForm from './EmailConfigForm.component';

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Button: jest
    .fn()
    .mockImplementation(({ loading, onClick, children }) => (
      <button onClick={onClick}>{loading ? 'Loader.Button' : children}</button>
    )),
}));

const mockOnCancel = jest.fn();
const mockOnFocus = jest.fn();
const mockOnSubmit = jest.fn();

const emailConfigValues = {
  emailingEntity: 'OpenMetadata',
  supportUrl: 'https://slack.open-metadata.org',
  enableSmtpServer: false,
  senderMail: 'test@gmail.com',
  serverEndpoint: 'http://localhost:3000',
  serverPort: 357,
  username: 'test',
  password: 'test',
  transportationStrategy: TransportationStrategy.SMTPTLS,
};

const mockProps = {
  emailConfigValues,
  isLoading: false,
  onCancel: mockOnCancel,
  onFocus: mockOnFocus,
  onSubmit: mockOnSubmit,
};

describe('Email Config Form Component', () => {
  it('should render email config component', () => {
    render(<EmailConfigForm {...mockProps} />);

    expect(screen.getByTestId('email-config-form')).toBeInTheDocument();
  });

  it('should render email config form', async () => {
    render(<EmailConfigForm {...mockProps} />);

    expect(screen.getByTestId('email-config-form')).toBeInTheDocument();
    // Labels of form elements
    expect(screen.getByText('label.username')).toBeInTheDocument();
    expect(screen.getByText('label.password')).toBeInTheDocument();
    expect(screen.getByText('label.sender-email')).toBeInTheDocument();
    expect(screen.getByText('label.server-endpoint')).toBeInTheDocument();
    expect(screen.getByText('label.server-port')).toBeInTheDocument();
    expect(screen.getByText('label.emailing-entity')).toBeInTheDocument();
    expect(screen.getByText('label.enable-smtp-server')).toBeInTheDocument();
    expect(screen.getByText('label.support-url')).toBeInTheDocument();
    expect(
      screen.getByText('label.transportation-strategy')
    ).toBeInTheDocument();
    expect(screen.getByText('label.cancel')).toBeInTheDocument();
    expect(screen.getByText('label.submit')).toBeInTheDocument();
    // Inputs and other form elements
    expect(screen.getByTestId('username-input')).toBeInTheDocument();
    expect(screen.getByTestId('password-input')).toBeInTheDocument();
    expect(screen.getByTestId('sender-email-input')).toBeInTheDocument();
    expect(screen.getByTestId('server-endpoint-input')).toBeInTheDocument();
    expect(screen.getByTestId('server-port-input')).toBeInTheDocument();
    expect(screen.getByTestId('emailing-entity-input')).toBeInTheDocument();
    expect(screen.getByTestId('smtp-server-input')).toBeInTheDocument();
    expect(screen.getByTestId('support-url-input')).toBeInTheDocument();
    expect(
      screen.getByTestId('transportation-strategy-input')
    ).toBeInTheDocument();
  });

  it('submit button should be in loading state', async () => {
    render(<EmailConfigForm {...mockProps} isLoading />);

    expect(screen.getByText('Loader.Button')).toBeInTheDocument();
  });

  it('should call onCancel', () => {
    render(<EmailConfigForm {...mockProps} />);

    fireEvent.click(screen.getByText('label.cancel'));

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should call onFocus', () => {
    render(<EmailConfigForm {...mockProps} />);

    fireEvent.focus(screen.getByTestId('username-input'));

    expect(mockOnFocus).toHaveBeenCalled();
  });

  it('should call onSubmit', async () => {
    render(<EmailConfigForm {...mockProps} />);

    await act(async () => {
      fireEvent.click(screen.getByText('label.submit'));
    });

    expect(mockOnSubmit).toHaveBeenCalledWith(emailConfigValues);
  });

  it('should not call onSubmit if required input are not filled', async () => {
    render(
      <EmailConfigForm
        {...mockProps}
        emailConfigValues={{
          username: 'test',
          password: 'test',
          senderMail: '',
          serverEndpoint: '',
          serverPort: 0,
        }}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByText('label.submit'));
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('should call onSubmit if password and username is not filled', async () => {
    render(
      <EmailConfigForm
        {...mockProps}
        emailConfigValues={{
          ...emailConfigValues,
          password: '',
          username: '',
        }}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByText('label.submit'));
    });

    expect(mockOnSubmit).toHaveBeenCalledWith({
      ...emailConfigValues,
      password: '',
      username: '',
    });
  });
});
