/*
 *  Copyright 2021 Collate
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
  fireEvent,
  getByTestId,
  queryByText,
  render,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import DropDown from './DropDown';

jest.mock('../../auth-provider/AuthProvider', () => {
  return {
    useAuthContext: jest.fn(() => ({
      isAuthDisabled: false,
      isAuthenticated: true,
      isProtectedRoute: jest.fn().mockReturnValue(true),
      isTourRoute: jest.fn().mockReturnValue(false),
      onLogoutHandler: jest.fn(),
    })),
  };
});

const mockDropDown = [
  { name: 'Test1', to: '/test1', disabled: false },
  { name: 'Test2', to: '/test2', disabled: false },
  { name: 'Test3', to: '/test3', disabled: false },
];

describe('Test DropDown Component', () => {
  it('Component should render', () => {
    const { container } = render(
      <DropDown dropDownList={mockDropDown} label="Settings" type="link" />,
      {
        wrapper: MemoryRouter,
      }
    );

    expect(getByTestId(container, 'dropdown-item')).toBeInTheDocument();
  });

  it('Dropdown menu should not be visible without clicking on it', () => {
    const { container } = render(
      <DropDown dropDownList={mockDropDown} label="Settings" type="link" />,
      {
        wrapper: MemoryRouter,
      }
    );

    expect(queryByText(container, 'Test1')).not.toBeInTheDocument();
    expect(queryByText(container, 'Test2')).not.toBeInTheDocument();
    expect(queryByText(container, 'Test3')).not.toBeInTheDocument();
  });

  it('Dropdown menu should be visible by clicking on it', () => {
    const { container } = render(
      <DropDown dropDownList={mockDropDown} label="Settings" type="link" />,
      {
        wrapper: MemoryRouter,
      }
    );

    const dropdown = getByTestId(container, 'menu-button');
    fireEvent.click(
      dropdown,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(queryByText(container, 'Test1')).toBeInTheDocument();
    expect(queryByText(container, 'Test2')).toBeInTheDocument();
    expect(queryByText(container, 'Test3')).toBeInTheDocument();
  });

  it('Dropdown menu should not be visible by on 2nd click', () => {
    const { container } = render(
      <DropDown dropDownList={mockDropDown} label="Settings" type="link" />,
      {
        wrapper: MemoryRouter,
      }
    );

    const dropdown = getByTestId(container, 'menu-button');
    fireEvent.click(
      dropdown,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(queryByText(container, 'Test1')).toBeInTheDocument();
    expect(queryByText(container, 'Test2')).toBeInTheDocument();
    expect(queryByText(container, 'Test3')).toBeInTheDocument();

    fireEvent.click(
      dropdown,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(queryByText(container, 'Test1')).not.toBeInTheDocument();
    expect(queryByText(container, 'Test2')).not.toBeInTheDocument();
    expect(queryByText(container, 'Test3')).not.toBeInTheDocument();
  });
});
