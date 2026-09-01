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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ReactNode } from 'react';

const mockShowErrorToast = jest.fn();

jest.mock('utils/ToastUtils', () => ({
  showErrorToast: mockShowErrorToast,
}));

jest.mock('../../../../../assets/svg/edit-square.svg', () => ({
  ReactComponent: () => <svg />,
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Button: ({
    children,
    onClick,
  }: {
    children?: ReactNode;
    onClick?: (...args: never[]) => void;
  }) => <button onClick={onClick}>{children}</button>,
}));

jest.mock('./FieldRow', () => ({
  __esModule: true,
  default: ({
    title,
    children,
  }: {
    title?: ReactNode;
    children?: ReactNode;
  }) => (
    <div>
      <span data-testid="field-title">{title}</span>
      {children}
    </div>
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import InlineEditCard from './InlineEditCard';

const setup = (
  props: Partial<React.ComponentProps<typeof InlineEditCard>> = {}
) =>
  render(
    <InlineEditCard
      canEdit
      renderEdit={() => <div data-testid="edit-form">editing</div>}
      title="Persona"
      view={<div data-testid="view">view</div>}
      onSave={jest.fn().mockResolvedValue(undefined)}
      {...props}
    />
  );

describe('InlineEditCard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the view, title and an edit affordance when canEdit', () => {
    setup();

    expect(screen.getByTestId('view')).toBeInTheDocument();
    expect(screen.getByTestId('field-title')).toHaveTextContent('Persona');
    expect(screen.getByLabelText('label.edit')).toBeInTheDocument();
  });

  it('keeps the title visible in edit mode', () => {
    setup();

    fireEvent.click(screen.getByLabelText('label.edit'));

    expect(screen.getByTestId('field-title')).toHaveTextContent('Persona');
    expect(screen.getByTestId('edit-form')).toBeInTheDocument();
  });

  it('hides the edit affordance when canEdit is false', () => {
    setup({ canEdit: false });

    expect(screen.queryByLabelText('label.edit')).not.toBeInTheDocument();
  });

  it('enters edit mode and renders the editor with save/cancel', () => {
    setup();

    fireEvent.click(screen.getByLabelText('label.edit'));

    expect(screen.getByTestId('edit-form')).toBeInTheDocument();
    expect(screen.getByText('label.cancel')).toBeInTheDocument();
    expect(screen.getByText('label.save-changes')).toBeInTheDocument();
  });

  it('saves and returns to the view on success', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    setup({ onSave });

    fireEvent.click(screen.getByLabelText('label.edit'));
    await act(async () => {
      fireEvent.click(screen.getByText('label.save-changes'));
    });

    expect(onSave).toHaveBeenCalled();

    await waitFor(() => expect(screen.getByTestId('view')).toBeInTheDocument());
  });

  it('shows a toast and stays in edit mode when save fails', async () => {
    const err = new Error('boom');
    setup({ onSave: jest.fn().mockRejectedValue(err) });

    fireEvent.click(screen.getByLabelText('label.edit'));
    await act(async () => {
      fireEvent.click(screen.getByText('label.save-changes'));
    });

    expect(mockShowErrorToast).toHaveBeenCalledWith(err);
    expect(screen.getByTestId('edit-form')).toBeInTheDocument();
  });

  it('cancels editing', () => {
    const onCancel = jest.fn();
    setup({ onCancel });

    fireEvent.click(screen.getByLabelText('label.edit'));
    fireEvent.click(screen.getByText('label.cancel'));

    expect(onCancel).toHaveBeenCalled();
    expect(screen.getByTestId('view')).toBeInTheDocument();
  });
});
