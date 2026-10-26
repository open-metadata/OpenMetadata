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
import { createPersona } from '../../../../rest/PersonaAPI';
import { AddEditPersonaForm } from './AddEditPersona.component';

jest.mock('../../../../rest/PersonaAPI', () => ({
  createPersona: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../../rest/userAPI', () => ({
  getUserById: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    currentUser: { id: 'user-1' },
    setCurrentUser: jest.fn(),
  })),
}));

jest.mock('../../../common/RichTextEditor/RichTextEditor', () =>
  jest.fn(() => <div data-testid="description" />)
);

jest.mock(
  '../../../common/UserSelectableList/UserSelectableList.component',
  () => ({
    UserSelectableList: jest.fn(({ children }) => <div>{children}</div>),
  })
);

describe('AddEditPersonaForm', () => {
  it('should create the persona from the trimmed form values', async () => {
    const onSave = jest.fn();
    render(<AddEditPersonaForm onCancel={jest.fn()} onSave={onSave} />);

    fireEvent.change(screen.getByTestId('name'), {
      target: { value: ' data-steward ' },
    });
    fireEvent.change(screen.getByTestId('displayName'), {
      target: { value: 'Data Steward' },
    });
    await act(async () => {
      fireEvent.click(screen.getByText('label.create'));
    });

    expect(createPersona).toHaveBeenCalledWith({
      name: 'data-steward',
      displayName: 'Data Steward',
      description: '',
      users: [],
    });
    expect(onSave).toHaveBeenCalled();
  });

  it('should not create the persona without a name', async () => {
    render(<AddEditPersonaForm onCancel={jest.fn()} onSave={jest.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByText('label.create'));
    });

    expect(createPersona).not.toHaveBeenCalled();
  });
});
