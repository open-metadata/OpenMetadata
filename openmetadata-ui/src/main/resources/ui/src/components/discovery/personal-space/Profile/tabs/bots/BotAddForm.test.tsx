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
import React from 'react';
import { useAuth } from '../../../../../../hooks/authHooks';
import { createBot } from '../../../../../../rest/botsAPI';
import { createUserWithPut } from '../../../../../../rest/userAPI';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import BotAddForm from './BotAddForm';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../../../../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue({ isAdminUser: true }),
}));

jest.mock('../../../../../../rest/botsAPI', () => ({
  createBot: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../../../../rest/userAPI', () => ({
  createUserWithPut: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../../../common/RichTextEditor/RichTextEditor', () =>
  React.forwardRef((_props: unknown, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({
      getEditorContent: () => 'bot description',
      clearEditorContent: jest.fn(),
      setEditorContent: jest.fn(),
    }));

    return <div data-testid="rich-text-editor" />;
  })
);

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div {...props}>{children}</div>
  ),
  Button: ({
    children,
    onPress,
    'data-testid': testId,
    isLoading,
  }: {
    children: React.ReactNode;
    onPress?: () => void;
    'data-testid'?: string;
    isLoading?: boolean;
  }) => (
    <button
      data-loading={isLoading}
      data-testid={testId}
      type="button"
      onClick={onPress}>
      {children}
    </button>
  ),
  Typography: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
  HookForm: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  FormFields: ({
    fields,
  }: {
    fields: Array<{ name: string; props?: Record<string, unknown> }>;
  }) => (
    <>
      {fields.map((f) => (
        <input key={f.name} {...(f.props ?? {})} />
      ))}
    </>
  ),
  FieldTypes: { TEXT: 'text', SELECT: 'select', SWITCH: 'switch' },
}));

const mockOnNavigate = jest.fn();

const renderForm = () => render(<BotAddForm onNavigate={mockOnNavigate} />);

describe('BotAddForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ isAdminUser: true });
  });

  it('should render the email field and action buttons', () => {
    renderForm();

    expect(screen.getByTestId('email')).toBeInTheDocument();
    expect(screen.getByTestId('submit-btn')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-btn')).toBeInTheDocument();
  });

  it('should navigate to the list on cancel', () => {
    renderForm();

    fireEvent.click(screen.getByTestId('cancel-btn'));

    expect(mockOnNavigate).toHaveBeenCalledWith({ type: 'list' });
  });

  it('should show the impersonation field only for admins', () => {
    renderForm();

    expect(screen.getByTestId('allow-impersonation')).toBeInTheDocument();
  });

  it('should hide the impersonation field for non-admins', () => {
    (useAuth as jest.Mock).mockReturnValue({ isAdminUser: false });
    renderForm();

    expect(screen.queryByTestId('allow-impersonation')).not.toBeInTheDocument();
  });

  it('should create the bot user then the bot entity and navigate on submit', async () => {
    renderForm();

    fireEvent.click(screen.getByTestId('submit-btn'));

    await waitFor(() => expect(createUserWithPut).toHaveBeenCalled());
    await waitFor(() => expect(createBot).toHaveBeenCalled());

    const userOrder = (createUserWithPut as jest.Mock).mock
      .invocationCallOrder[0];
    const botOrder = (createBot as jest.Mock).mock.invocationCallOrder[0];

    expect(userOrder).toBeLessThan(botOrder);

    await waitFor(() =>
      expect(mockOnNavigate).toHaveBeenCalledWith({ type: 'list' })
    );
  });

  it('should show an error toast when creation fails', async () => {
    (createUserWithPut as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    renderForm();

    fireEvent.click(screen.getByTestId('submit-btn'));

    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());

    expect(createBot).not.toHaveBeenCalled();
  });
});
