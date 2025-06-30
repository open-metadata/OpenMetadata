/*
 *  Copyright 2022 Collate.
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
  findByTestId,
  findByText,
  queryByTestId,
  queryByText,
  render,
} from '@testing-library/react';
import { forwardRef } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import CreateUser from './CreateUser.component';
import { CreateUserProps } from './CreateUser.interface';

jest.mock('react-router-dom', () => ({
  useLocation: jest.fn().mockReturnValue({
    state: { isAdminPage: false },
  }),
}));

jest.mock('../../Team/TeamsSelectable/TeamsSelectable', () => {
  return jest.fn().mockReturnValue(<p>TeamsSelectable component</p>);
});

jest.mock('../../../common/RichTextEditor/RichTextEditor', () => {
  return forwardRef(
    jest.fn().mockImplementation(({ initialValue }, ref) => {
      return <div ref={ref}>{initialValue}MarkdownWithPreview component</div>;
    })
  );
});

const propsValue: CreateUserProps = {
  isLoading: false,
  roles: [],
  forceBot: false,
  onSave: jest.fn(),
  onCancel: jest.fn(),
};

describe('Test CreateUser component', () => {
  it('CreateUser component should render properly', async () => {
    const { container } = render(<CreateUser {...propsValue} />, {
      wrapper: MemoryRouter,
    });

    const email = await findByTestId(container, 'email');
    const admin = await findByTestId(container, 'admin');
    const cancelButton = await findByTestId(container, 'cancel-user');
    const saveButton = await findByTestId(container, 'save-user');
    const description = await findByText(
      container,
      /MarkdownWithPreview component/i
    );

    const teamsSelectable = await findByText(
      container,
      /TeamsSelectable component/i
    );
    const roleSelectInput = queryByTestId(container, 'roles-dropdown');

    expect(email).toBeInTheDocument();
    expect(admin).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(roleSelectInput).toBeInTheDocument();
    expect(teamsSelectable).toBeInTheDocument();
    expect(cancelButton).toBeInTheDocument();
    expect(saveButton).toBeInTheDocument();
  });

  it('should not visible team and role input if isAdminPage true', async () => {
    (useLocation as jest.Mock).mockReturnValue({
      state: { isAdminPage: true },
    });

    const { container } = render(<CreateUser {...propsValue} />, {
      wrapper: MemoryRouter,
    });

    const roleSelectInput = queryByTestId(container, 'roles-dropdown');
    const teamsSelectable = queryByText(
      container,
      /TeamsSelectable component/i
    );

    expect(roleSelectInput).not.toBeInTheDocument();
    expect(teamsSelectable).not.toBeInTheDocument();
  });
});
