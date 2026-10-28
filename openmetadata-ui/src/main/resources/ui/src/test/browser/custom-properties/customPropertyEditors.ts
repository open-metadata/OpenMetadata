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

/**
 * The custom property value editors, driven as a user would, for every
 * property type: what to type (the values of playwright/utils/customProperty.ts
 * `getPropertyValues`), what the page must then send in the entity's
 * `extension`, and what the card or panel row shows once it has.
 */
import { expect } from 'vitest';
import { Locator, page, userEvent } from 'vitest/browser';
import { CustomProperty } from '../../../generated/type/customProperty';
import { pickDate, TEAMS, USERS } from '../entity-matrix/entityMatrix';
import { FieldTypeName } from '../fixtures/customProperties';

type Referenced = (typeof USERS)[number] | (typeof TEAMS)[number];

const ref = (entity: Referenced) => ({
  id: entity.id,
  type: entity.type,
  name: entity.name,
  displayName: entity.displayName,
  fullyQualifiedName: entity.fullyQualifiedName,
});

export interface PropertyValue {
  /** What the user enters; the format of the spec's `getPropertyValues`. */
  input: string;
  /** What the page must send for it in `extension[<property>]`. */
  saved: unknown;
}

/** First value and updated value per type, as in the spec. */
export const VALUES: Record<FieldTypeName, [PropertyValue, PropertyValue]> = {
  integer: [
    { input: '123', saved: 123 },
    { input: '456', saved: 456 },
  ],
  string: [
    { input: 'string value', saved: 'string value' },
    { input: 'new string value', saved: 'new string value' },
  ],
  markdown: [
    { input: 'Bold statement', saved: '<p>Bold statement</p>' },
    { input: 'Italic statement', saved: '<p>Italic statement</p>' },
  ],
  number: [
    { input: '1234', saved: 1234 },
    { input: '4567', saved: 4567 },
  ],
  duration: [
    { input: 'PT1H', saved: 'PT1H' },
    { input: 'PT2H', saved: 'PT2H' },
  ],
  email: [
    { input: 'john@gamil.com', saved: 'john@gamil.com' },
    { input: 'user@getcollate.io', saved: 'user@getcollate.io' },
  ],
  enum: [
    { input: 'small', saved: ['small'] },
    { input: 'medium', saved: ['medium'] },
  ],
  sqlQuery: [
    { input: 'Select * from table', saved: 'Select * from table' },
    {
      input: 'Select * from table where id = 1',
      saved: 'Select * from table where id = 1',
    },
  ],
  timestamp: [
    { input: '1710831125922', saved: 1710831125922 },
    { input: '1710831125923', saved: 1710831125923 },
  ],
  entityReference: [
    { input: USERS[0].displayName, saved: ref(USERS[0]) },
    { input: USERS[1].displayName, saved: ref(USERS[1]) },
  ],
  entityReferenceList: [
    {
      input: `${USERS[2].displayName},${TEAMS[0].displayName}`,
      saved: [ref(USERS[2]), ref(TEAMS[0])],
    },
    { input: USERS[0].displayName, saved: [ref(USERS[0])] },
  ],
  timeInterval: [
    {
      input: '1710831125922,1710831125924',
      saved: { start: 1710831125922, end: 1710831125924 },
    },
    {
      input: '1710831125924,1710831125926',
      saved: { start: 1710831125924, end: 1710831125926 },
    },
  ],
  'time-cp': [
    { input: '15:35:59', saved: '15:35:59' },
    { input: '17:35:59', saved: '17:35:59' },
  ],
  'date-cp': [
    { input: '2024-07-09', saved: '2024-07-09' },
    { input: '2025-07-09', saved: '2025-07-09' },
  ],
  'dateTime-cp': [
    { input: '2024-07-09 15:07:59', saved: '2024-07-09 15:07:59' },
    { input: '2025-07-09 15:07:59', saved: '2025-07-09 15:07:59' },
  ],
  'table-cp': [
    {
      input: 'column1,column2',
      saved: {
        columns: ['pw-column1', 'pw-column2'],
        rows: [{ 'pw-column1': 'column1', 'pw-column2': 'column2' }],
      },
    },
    {
      input: 'column3,column4',
      saved: {
        columns: ['pw-column1', 'pw-column2'],
        rows: [{ 'pw-column1': 'column3', 'pw-column2': 'column4' }],
      },
    },
  ],
  'hyperlink-cp': [
    {
      input: 'https://example.com,Example Link',
      saved: { url: 'https://example.com', displayText: 'Example Link' },
    },
    {
      input: 'https://openmetadata.io,OpenMetadata',
      saved: { url: 'https://openmetadata.io', displayText: 'OpenMetadata' },
    },
  ],
};

export const editModal = () => page.getByTestId('custom-property-edit-modal');

/**
 * Opens the edit modal from a card or row: its pencil when the property has a
 * value, its "Set …" button when it has none.
 */
export const openEditModal = async (scope: Locator) => {
  const trigger = scope
    .getByTestId('edit-icon')
    .or(scope.getByTestId('add-value-button'))
    .first();
  await userEvent.click(trigger);

  await expect.element(editModal()).toBeVisible();
};

/**
 * Clicks the modal's title so an open listbox no longer covers the footer.
 * The open combobox aria-hides the rest of the modal, hence `includeHidden`.
 */
export const closeListbox = () =>
  userEvent.click(
    editModal().getByRole('heading', { includeHidden: true }).first()
  );

/** Types `HH:mm:ss` into the core TimePicker's segments. */
const typeTime = async (time: string) => {
  await userEvent.click(
    editModal()
      .getByTestId('time-picker')
      .getByRole('spinbutton', { name: /hour/i })
  );
  // Segments advance on their own after two digits.
  await userEvent.keyboard(time.replace(/:/g, ''));
};

/** Picks `yyyy-MM-dd` in the core DatePicker's calendar. */
const typeDate = (isoDate: string) => {
  const [year, month, day] = isoDate.split('-').map(Number);

  return pickDate(
    editModal()
      .getByTestId('date-time-picker')
      .getByRole('button', { name: 'Calendar' }),
    new Date(year, month - 1, day)
  );
};

/** Removes every picked chip of an Autocomplete, one at a time. */
const clearChips = async (scope: Locator) => {
  const chip = scope.getByTestId('autocomplete-selected-item').first();
  while (chip.query()) {
    const count = scope.getByTestId('autocomplete-selected-item').all().length;
    await userEvent.click(chip.getByRole('button', { name: /^Remove / }));

    await expect
      .poll(() => scope.getByTestId('autocomplete-selected-item').all().length)
      .toBe(count - 1);
  }
};

/** Picks each comma-separated name in the entity-reference search. */
const pickReferences = async (names: string) => {
  const list = editModal().getByTestId('asset-select-list');
  // A single reference hides its input while a value is picked: clear first.
  await clearChips(list);
  for (const name of names.split(',')) {
    await userEvent.fill(list.getByRole('combobox'), name);
    await userEvent.click(
      page.getByRole('option').filter({ has: page.getByTestId(name) })
    );

    await expect
      .element(
        list.getByTestId('autocomplete-selected-item').filter({ hasText: name })
      )
      .toBeVisible();
  }
  await closeListbox();
};

/** The block editor has no role or test id of its own; find it by class. */
export const blockEditor = (scope: Locator = editModal()) =>
  scope.getByCSS('.om-block-editor[contenteditable="true"]');

const fillTestId = (testId: string) => (input: string) =>
  userEvent.fill(editModal().getByTestId(testId), input);

const replaceIn =
  (editor: () => Locator, clear: string) => async (input: string) => {
    await userEvent.click(editor());
    await userEvent.keyboard(`{ControlOrMeta>}a{/ControlOrMeta}${clear}`);
    await userEvent.keyboard(input);
  };

const pickEnum = async (input: string) => {
  const select = editModal().getByTestId('enum-select');
  await clearChips(select);
  await userEvent.fill(select.getByRole('combobox'), input);
  await userEvent.click(page.getByRole('option', { name: input, exact: true }));
  await closeListbox();
};

const enterInterval = async (input: string) => {
  const [start, end] = input.split(',');
  // Epoch inputs sit behind the editor's "Enter manually" switch.
  if (!editModal().getByTestId('start-input').query()) {
    await userEvent.click(
      editModal().getByTestId('time-interval-manual-toggle')
    );
  }
  await userEvent.fill(editModal().getByTestId('start-input'), start);
  await userEvent.fill(editModal().getByTestId('end-input'), end);
};

const enterDateTime = async (input: string) => {
  const [date, time] = input.split(' ');
  await typeDate(date);
  if (time) {
    await typeTime(time);
  }
};

const enterRow = async (input: string) => {
  const [first, second] = input.split(',');
  await userEvent.fill(editModal().getByTestId('pw-column1-0'), first);
  await userEvent.fill(editModal().getByTestId('pw-column2-0'), second);
};

const enterHyperlink = async (input: string) => {
  const [url, displayText = ''] = input.split(',');
  await userEvent.fill(editModal().getByTestId('hyperlink-url-input'), url);
  await userEvent.fill(
    editModal().getByTestId('hyperlink-display-text-input'),
    displayText
  );
};

/** How a user enters a value in each type's editor (the modal must be open). */
const EDITORS: Record<FieldTypeName, (input: string) => Promise<void>> = {
  integer: fillTestId('value-input'),
  string: fillTestId('value-input'),
  number: fillTestId('value-input'),
  email: fillTestId('email-input'),
  duration: fillTestId('duration-input'),
  timestamp: fillTestId('timestamp-input'),
  markdown: replaceIn(() => blockEditor(), '{Backspace}'),
  sqlQuery: replaceIn(() => editModal().getByCSS('.cm-content'), '{Delete}'),
  enum: pickEnum,
  timeInterval: enterInterval,
  'time-cp': typeTime,
  'date-cp': enterDateTime,
  'dateTime-cp': enterDateTime,
  entityReference: pickReferences,
  entityReferenceList: pickReferences,
  'table-cp': enterRow,
  'hyperlink-cp': enterHyperlink,
};

/** Enters `input` in the modal's editor for `type` (the modal must be open). */
export const enterValue = (type: FieldTypeName, input: string) =>
  EDITORS[type](input);

/** Opens the modal from `scope`, enters `input` and saves; the modal closes. */
export const setValue = async (
  scope: Locator,
  property: CustomProperty,
  input: string
) => {
  await openEditModal(scope);
  await enterValue(property.propertyType.name as FieldTypeName, input);
  await userEvent.click(editModal().getByTestId('inline-save-btn'));

  await expect.element(editModal()).not.toBeInTheDocument();
};

type CardCheck = (card: Locator, input: string) => Promise<void>;

const showsText =
  (testId: string): CardCheck =>
  (card, input) =>
    expect.element(card.getByTestId(testId)).toHaveTextContent(input);

const showsInterval: CardCheck = async (card, input) => {
  const [start, end] = input.split(',');
  const interval = card.getByTestId('time-interval-value');

  // The timeline shows formatted dates; the raw epoch bounds are attributes.
  await expect.element(interval).toHaveAttribute('data-start', start);
  await expect.element(interval).toHaveAttribute('data-end', end);
};

const showsRow: CardCheck = async (card, input) => {
  const [first, second] = input.split(',');

  // The first column heads its row, so it names the row.
  await expect
    .element(
      card
        .getByTestId('table-type-property-value')
        .getByRole('row', { name: first, exact: true })
    )
    .toHaveTextContent(second);
};

const showsLink: CardCheck = async (card, input) => {
  const [url, displayText] = input.split(',');
  const link = card.getByTestId('hyperlink-value');

  await expect.element(link).toHaveAttribute('href', url);
  await expect.element(link).toHaveTextContent(displayText ?? url);
};

const showsReferences: CardCheck = async (card, input) => {
  for (const name of input.split(',')) {
    await expect.element(card.getByTestId(name)).toBeVisible();
  }
};

const CARD_CHECKS: Partial<Record<FieldTypeName, CardCheck>> = {
  enum: showsText('enum-value'),
  timeInterval: showsInterval,
  sqlQuery: (card, input) =>
    expect.element(card.getByCSS('.cm-content')).toHaveTextContent(input),
  'table-cp': showsRow,
  'hyperlink-cp': showsLink,
  entityReference: showsReferences,
  entityReferenceList: showsReferences,
};

/** What a card shows once `input` is saved for `type`. */
export const expectCardShows = (
  card: Locator,
  type: FieldTypeName,
  input: string
) => (CARD_CHECKS[type] ?? showsText('property-value'))(card, input);
