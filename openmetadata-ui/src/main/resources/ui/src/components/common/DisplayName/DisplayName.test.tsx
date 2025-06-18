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
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DisplayName from './DisplayName';
import { DisplayNameProps } from './DisplayName.interface';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Link: jest
    .fn()
    .mockImplementation(({ children, ...props }) => (
      <span {...props}>{children}</span>
    )),
}));

jest.mock('../../../constants/constants', () => ({
  DE_ACTIVE_COLOR: '#BFBFBF',
  ICON_DIMENSION: { width: 16, height: 16 },
}));

jest.mock('../../Modals/EntityNameModal/EntityNameModal.component', () =>
  jest.fn().mockImplementation(() => <p>Mocked Modal</p>)
);

const mockOnEditDisplayName = jest.fn();

const mockProps: DisplayNameProps = {
  id: '1',
  name: 'Sample Entity',
  displayName: 'Sample Display Name',
  link: '/entity/1',
  allowRename: true,
  hasEditPermission: true,
  onEditDisplayName: mockOnEditDisplayName,
};

describe('Test DisplayName Component', () => {
  it('Should render the component with the display name', async () => {
    render(
      <MemoryRouter>
        <DisplayName {...mockProps} />
      </MemoryRouter>
    );

    const displayNameField = await screen.getByTestId('column-display-name');

    expect(displayNameField).toBeInTheDocument();
    expect(displayNameField).toHaveTextContent('Sample Display Name');

    const editButton = screen.queryByTestId('edit-displayName-button');

    expect(editButton).toBeInTheDocument();
  });

  it('Should render the component with name when display name is empty', async () => {
    render(
      <MemoryRouter>
        <DisplayName {...mockProps} displayName={undefined} />
      </MemoryRouter>
    );

    const nameField = screen.getByTestId('column-name');

    expect(nameField).toBeInTheDocument();
    expect(nameField).toHaveTextContent('Sample Entity');
  });

  it('Should open the edit modal on edit button click', async () => {
    render(
      <MemoryRouter>
        <DisplayName {...mockProps} />
      </MemoryRouter>
    );
    const editButton = screen.getByTestId('edit-displayName-button');
    fireEvent.click(editButton);

    const nameField = await screen.findByTestId('column-name');

    expect(nameField).toBeInTheDocument();

    const displayNameField = await screen.findByTestId('column-display-name');

    expect(displayNameField).toBeInTheDocument();
  });

  it('Should render a link when link prop is provided', async () => {
    render(
      <MemoryRouter>
        <DisplayName {...mockProps} />
      </MemoryRouter>
    );

    const linkElement = screen.getByTestId('Sample Entity');

    expect(linkElement.tagName).toBe('SPAN');
    expect(linkElement).toHaveTextContent('Sample Display Name');
  });

  it('Should render plain text when link prop is not provided', async () => {
    const propsWithoutLink = { ...mockProps, link: undefined };

    render(
      <MemoryRouter>
        <DisplayName {...propsWithoutLink} />
      </MemoryRouter>
    );

    const nameElement = screen.getByTestId('Sample Entity');

    expect(nameElement.tagName).toBe('SPAN');
    expect(nameElement).toHaveTextContent('Sample Display Name');
  });

  it('Should render name as a link when displayName is empty and link is provided', async () => {
    const props = { ...mockProps, displayName: '', link: '/entity/1' };

    render(
      <MemoryRouter>
        <DisplayName {...props} />
      </MemoryRouter>
    );

    const nameElement = screen.getByTestId('Sample Entity');

    expect(nameElement).toBeInTheDocument();
    expect(nameElement).toHaveTextContent('Sample Entity');
  });
});
