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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Category, Type } from '../../../../generated/entity/type';
import english from '../../../../locale/languages/en-us.json';
import {
  addPropertyToEntity,
  getTypeByFQN,
  getTypeListByCategory,
} from '../../../../rest/metadataTypeAPI';
import AddCustomProperty from './AddCustomProperty';

jest.mock('../../../../rest/metadataTypeAPI');
jest.unmock('react-i18next');
jest.unmock('../../../../utils/i18next/LocalUtil');

const stringType: Type = {
  id: '05e7b2f2-cf1e-4f9f-ae8b-3011372f361e',
  name: 'string',
  displayName: 'String',
  description: 'String field type',
  category: Category.Field,
};
const tableType: Type = {
  id: '153a0c07-6480-404e-990b-555a42c8a7b5',
  name: 'table',
  description: 'Table entity type',
  category: Category.Entity,
};
const invalidNameMessage = String.raw`Name must start with a letter or number. Invalid characters: " * : ^ $ \ < > & ~ /`;
const i18n = createInstance();

const renderForm = () => {
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/properties', '/properties/table/add']}>
        <Routes>
          <Route element={<div>Custom properties</div>} path="/properties" />
          <Route
            element={<AddCustomProperty open />}
            path="/properties/:entityType/add"
          />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>
  );
};

const fillRequiredFields = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: /Type/ }));
  await user.click(await screen.findByRole('option', { name: 'String' }));

  const description = screen
    .getByTestId('editor')
    .querySelector<HTMLElement>('[contenteditable="true"]');
  if (!description) {
    throw new Error('The description editor did not render');
  }
  // jsdom has no clipboard implementation; the real editor still parses the paste.
  fireEvent.paste(description, {
    clipboardData: {
      getData: (type: string) =>
        type === 'text/plain' ? 'A custom property description' : '',
      items: [],
      files: [],
      types: ['text/plain'],
    },
  });
};

describe('AddCustomProperty form validation', () => {
  beforeAll(async () => {
    const createRange = document.createRange.bind(document);
    jest.spyOn(document, 'createRange').mockImplementation(() => {
      const range = createRange();
      range.getBoundingClientRect = () => new DOMRect();

      return range;
    });
    await i18n.init({
      lng: 'en-US',
      resources: { 'en-US': { translation: english } },
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    (
      getTypeByFQN as jest.MockedFunction<typeof getTypeByFQN>
    ).mockResolvedValue(tableType);
    (
      getTypeListByCategory as jest.MockedFunction<typeof getTypeListByCategory>
    ).mockResolvedValue({
      data: [stringType],
      paging: { total: 1 },
    });
    (
      addPropertyToEntity as jest.MockedFunction<typeof addPropertyToEntity>
    ).mockResolvedValue(tableType);
  });

  it.each([
    ['a non-alphanumeric first character', '_invalidName'],
    ['a colon', 'name:with:colon'],
    ['a dollar sign', 'name$invalid'],
    ['a caret', 'name^invalid'],
    ['a double quote', 'name"invalid'],
    ['a backslash', String.raw`name\invalid`],
    ['a less-than sign', 'name<invalid'],
    ['a greater-than sign', 'name>invalid'],
    ['an ampersand', 'name&invalid'],
    ['an asterisk', 'name*invalid'],
    ['a forward slash', 'name/invalid'],
    ['a tilde', 'name~invalid'],
  ])('rejects %s and prevents submission', async (_case, name) => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderForm();
    await fillRequiredFields(user);

    fireEvent.change(screen.getByTestId('name'), { target: { value: name } });
    fireEvent.submit(screen.getByTestId('custom-property-form'));

    expect(await screen.findByText(invalidNameMessage)).toBeVisible();
    expect(screen.getByTestId('create-button')).toBeDisabled();
    expect(addPropertyToEntity).not.toHaveBeenCalled();
  });

  it('rejects a name longer than 256 characters', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderForm();
    await fillRequiredFields(user);

    fireEvent.change(screen.getByTestId('name'), {
      target: { value: 'a'.repeat(257) },
    });
    fireEvent.submit(screen.getByTestId('custom-property-form'));

    expect(
      await screen.findByText('Name size must be between 1 and 256')
    ).toBeVisible();
    expect(screen.getByTestId('create-button')).toBeDisabled();
    expect(addPropertyToEntity).not.toHaveBeenCalled();
  });

  it('requires a name before submitting', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderForm();
    await fillRequiredFields(user);

    fireEvent.submit(screen.getByTestId('custom-property-form'));

    expect(await screen.findByText('Name is required')).toBeVisible();
    expect(screen.getByTestId('create-button')).toBeDisabled();
    expect(addPropertyToEntity).not.toHaveBeenCalled();
  });

  it.each([
    ['a letter', 'validName_123'],
    ['a number', '1validName'],
    ['allowed punctuation', "valid Name.!@#%`()_-=+{}[]|;',.?"],
    ['the minimum length', 'a'],
    ['the maximum length', 'a'.repeat(256)],
  ])(
    'submits a name with %s after correcting an error',
    async (_case, name) => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      renderForm();
      await fillRequiredFields(user);

      const nameInput = screen.getByTestId('name');
      fireEvent.change(nameInput, { target: { value: 'invalid:name' } });
      fireEvent.submit(screen.getByTestId('custom-property-form'));

      expect(await screen.findByText(invalidNameMessage)).toBeVisible();

      fireEvent.change(nameInput, { target: { value: name } });
      await waitFor(() => {
        expect(screen.queryByText(invalidNameMessage)).not.toBeInTheDocument();
        expect(screen.getByTestId('create-button')).toBeEnabled();
      });
      await user.click(screen.getByTestId('create-button'));

      expect(await screen.findByText('Custom properties')).toBeVisible();
      expect(addPropertyToEntity).toHaveBeenCalledTimes(1);
      expect(addPropertyToEntity).toHaveBeenCalledWith(tableType.id, {
        name,
        description: '<p>A custom property description</p>',
        propertyType: { id: stringType.id, type: 'type' },
      });
    }
  );

  it('returns to the property list without saving when cancelled', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderForm();

    await user.click(screen.getByTestId('cancel-button'));

    expect(await screen.findByText('Custom properties')).toBeVisible();
    expect(addPropertyToEntity).not.toHaveBeenCalled();
  });
});
