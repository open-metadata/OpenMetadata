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
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { EntityType } from '../../../enums/entity.enum';
import EntityNameModal from '../../Modals/EntityNameModal/EntityNameModal.component';
import DisplayName from './DisplayName';
import { DisplayNameProps } from './DisplayName.interface';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Link: jest.fn().mockImplementation(({ children, ...props }) => (
    // eslint-disable-next-line jsx-a11y/anchor-is-valid -- test mock for react-router Link
    <a href="#" {...props}>
      {children}
    </a>
  )),
}));

jest.mock('../../../constants/constants', () => ({
  DE_ACTIVE_COLOR: '#BFBFBF',
  ICON_DIMENSION: { width: 16, height: 16 },
}));

// Keep `EntityNameModal` mocked at the unit level so the existing tests are
// unaffected, but capture props on a real `jest.fn()` so we can assert on
// what `DisplayName` seeds into the modal — exactly the contract the
// highlighted-name bug broke.
jest.mock('../../Modals/EntityNameModal/EntityNameModal.component', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => <p>Mocked Modal</p>),
}));

jest.mock('../../../utils/RouterUtils', () => ({
  getEntityDetailsPath: jest
    .fn()
    .mockImplementation((_entityType, fqn) => `/entity/${fqn}`),
  getEntityDetailsUrl: jest
    .fn()
    .mockImplementation((_entityType, fqn) => `http://localhost/entity/${fqn}`),
}));

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

    const linkElements = screen.getAllByTestId('Sample Entity');

    expect(linkElements.length).toBeGreaterThanOrEqual(1);
    expect(linkElements[0].tagName).toBe('A');
  });

  it('Should render plain text when link prop is not provided', async () => {
    const propsWithoutLink = { ...mockProps, link: undefined };

    render(
      <MemoryRouter>
        <DisplayName {...propsWithoutLink} />
      </MemoryRouter>
    );

    const nameElements = screen.getAllByTestId('Sample Entity');

    expect(nameElements.length).toBeGreaterThanOrEqual(1);
    expect(nameElements[0].tagName).toBe('SPAN');
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

  it('Should render copy link button when entityType is provided', async () => {
    const props = {
      ...mockProps,
      entityType: EntityType.DASHBOARD_DATA_MODEL,
    };

    render(
      <MemoryRouter>
        <DisplayName {...props} />
      </MemoryRouter>
    );

    const copyButton = screen.getByTestId('copy-column-link-button');

    expect(copyButton).toBeInTheDocument();
  });

  it('Should not render copy link button when entityType is not provided', async () => {
    render(
      <MemoryRouter>
        <DisplayName {...mockProps} />
      </MemoryRouter>
    );

    const copyButton = screen.queryByTestId('copy-column-link-button');

    expect(copyButton).not.toBeInTheDocument();
  });

  it('Should copy link to clipboard when copy button is clicked', async () => {
    const mockWriteText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      writable: true,
    });

    const props = {
      ...mockProps,
      entityType: EntityType.DASHBOARD_DATA_MODEL,
    };

    render(
      <MemoryRouter>
        <DisplayName {...props} />
      </MemoryRouter>
    );

    const copyButton = screen.getByTestId('copy-column-link-button');

    await act(async () => {
      fireEvent.click(copyButton);
    });

    expect(mockWriteText).toHaveBeenCalledWith(expect.stringContaining('1'));
  });

  // Regression tests for the highlighted-name edit bug
  // (https://github.com/open-metadata/OpenMetadata/issues — "UI: Editing display
  // name fails when entity name is highlighted by search"). The bug: when
  // `name` is a search-highlight ReactNode (the output of
  // `renderHighlightedText(highlightSearchText(record.name, searchValue))`),
  // `DisplayName` previously seeded `EntityNameModal` with `name: ''`, which
  // blocked Save ("Name is required") on a required, disabled field. The fix
  // adds an `entityName?: string` raw string that callers pass alongside the
  // highlighted `name` node, and `DisplayName` prefers it for seeding.
  describe('Edit modal seeding under search highlighting', () => {
    const openEditModal = () => {
      render(
        <MemoryRouter>
          <DisplayName {...mockProps} />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('edit-displayName-button'));
    };

    const lastModalCall = () => {
      const calls = (EntityNameModal as unknown as jest.Mock).mock.calls;

      return calls[calls.length - 1][0] as {
        entity: { name: string; displayName?: string };
      };
    };

    it('seeds the modal name with a plain-string `name` (no regression)', () => {
      openEditModal();

      expect(lastModalCall().entity.name).toBe('Sample Entity');
    });

    it('seeds the modal name from `entityName` when `name` is a highlighted ReactNode', () => {
      // Mimic what `renderHighlightedText(highlightSearchText('UserDatabase', 'data'))`
      // produces — a `<span className="text-highlighter">…</span>` ReactNode,
      // NOT a plain string. `isString(name)` is `false` here.
      const highlightedName: ReactNode = (
        <span>
          <span className="text-highlighter">data</span>
          base
        </span>
      );

      render(
        <MemoryRouter>
          <DisplayName
            {...mockProps}
            entityName="UserDatabase"
            name={highlightedName}
          />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('edit-displayName-button'));

      // The raw `entityName` must be preferred over the highlighted node —
      // the bug seeded `''` and blocked Save ("Name is required").
      expect(lastModalCall().entity.name).toBe('UserDatabase');
    });

    it('falls back to empty string when `name` is a ReactNode and `entityName` is not supplied (legacy callers)', () => {
      const highlightedName: ReactNode = (
        <span>
          <span className="text-highlighter">data</span>
          base
        </span>
      );

      render(
        <MemoryRouter>
          <DisplayName {...mockProps} name={highlightedName} />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('edit-displayName-button'));

      // No crash; graceful fallback to '' — keeps existing un-migrated
      // callers behaving exactly as before this fix landed.
      expect(lastModalCall().entity.name).toBe('');
    });

    it('prefers `entityName` over a plain-string `name` when both are supplied', () => {
      render(
        <MemoryRouter>
          <DisplayName {...mockProps} entityName="RawRecordName" name="Other" />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('edit-displayName-button'));

      expect(lastModalCall().entity.name).toBe('RawRecordName');
    });
  });
});
