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
 * The settings flows of playwright/e2e/Pages/CustomProperties.spec.ts: an
 * admin creates a custom property of each type (with its config) on an entity
 * type's settings page, edits it, finds it among the advanced search fields
 * on Explore, and deletes it. Real pages; only the network is mocked. Each
 * step asserts what the page sent to the types API and what it shows.
 */
import { describe, expect, test } from 'vitest';
import { Locator, page, userEvent } from 'vitest/browser';
import { CustomProperty } from '../../../generated/type/customProperty';
import { serveEntityType, TypeServer } from '../fixtures/customProperties';
import { serveSearch } from '../fixtures/search';
import { renderApp } from '../renderWithApp';
import {
  modal,
  openAdvancedSearch,
  pickField,
} from '../advanced-search/queryBuilder';
import { blockEditor } from './customPropertyEditors';

/** One entity type's settings page, keyed as the spec keys it. */
export interface SettingsEntity {
  /** The settings path segment (`ENTITY_PATH` key), e.g. `tables`. */
  path: string;
  /** The entity type its properties belong to, e.g. `table`. */
  entityType: string;
}

/** A property type as the add form lists it, with the spec's config. */
export interface PropertyKind {
  /** The type's option label in the form, e.g. `Sql Query`. */
  label: string;
  /** The seeded type's name, e.g. `sqlQuery`. */
  type: string;
  config?: {
    enum?: string[];
    columns?: string[];
    entityReferences?: string[];
    format?: string;
  };
  /** The labels it adds to the advanced search fields; none = not searched. */
  searchFields?: (label: string) => string[];
}

const one = (label: string) => [label];

/** The basic and configured types of the spec, with its configs. */
export const PROPERTY_KINDS: PropertyKind[] = [
  { label: 'Integer', type: 'integer', searchFields: one },
  { label: 'String', type: 'string', searchFields: one },
  { label: 'Markdown', type: 'markdown', searchFields: one },
  { label: 'Duration', type: 'duration', searchFields: one },
  { label: 'Email', type: 'email', searchFields: one },
  { label: 'Number', type: 'number', searchFields: one },
  { label: 'Sql Query', type: 'sqlQuery', searchFields: one },
  {
    label: 'Time Interval',
    type: 'timeInterval',
    searchFields: (l) => [`${l} (Start)`, `${l} (End)`],
  },
  { label: 'Timestamp', type: 'timestamp', searchFields: one },
  {
    label: 'Hyperlink',
    type: 'hyperlink-cp',
    searchFields: (l) => [`${l} URL`, `${l} Display Text`],
  },
  {
    label: 'Enum',
    type: 'enum',
    config: { enum: ['enum1', 'enum2', 'enum3'] },
    searchFields: one,
  },
  {
    label: 'Table',
    type: 'table-cp',
    config: { columns: ['pw-column1', 'pw-column2'] },
    searchFields: (l) => [`${l} - pw-column1`, `${l} - pw-column2`],
  },
  {
    label: 'Entity Reference',
    type: 'entityReference',
    config: { entityReferences: ['User', 'Team', 'Metric'] },
    searchFields: one,
  },
  {
    label: 'Entity Reference List',
    type: 'entityReferenceList',
    config: { entityReferences: ['User', 'Team', 'Metric'] },
    searchFields: one,
  },
  { label: 'Date', type: 'date-cp', config: { format: 'yyyy-MM-dd' } },
  {
    label: 'Time',
    type: 'time-cp',
    config: { format: 'HH:mm:ss' },
    searchFields: one,
  },
  {
    label: 'Date Time',
    type: 'dateTime-cp',
    config: { format: 'yyyy-MM-dd HH:mm:ss' },
    searchFields: one,
  },
];

/** The spec's name suffix: every character a property name may hold. */
const NAME_SUFFIX = ".!@#%`()_-=+{}[]|;',.?";
const NAME_ERROR =
  'Name must start with a letter or number. Invalid characters: " * : ^ $ \\ < > & ~ /';
const DESCRIPTION = 'This is new description';

const drawer = () => page.getByTestId('add-custom-property-drawer');
const form = () => page.getByTestId('custom-property-form');
const row = (name: string) => page.getByCSS(`[data-row-key="${name}"]`);

/** Opens a core Select by its trigger and picks `option`. */
const choose = async (field: Locator, option: string) => {
  await userEvent.click(field.getByRole('button').first());
  await userEvent.click(
    page.getByRole('option', { name: option, exact: true })
  );

  await expect.element(field).toHaveTextContent(option);
};

/** Adds each value to a creatable multi-select by typing it and pressing Enter. */
const addValues = async (field: Locator, values: string[]) => {
  const input = field.getByRole('combobox');
  for (const value of values) {
    await userEvent.fill(input, value);
    await userEvent.keyboard('{Enter}');

    await expect.element(input).toHaveValue('');
  }
};

/** Picks each option of a non-creatable multi-select. */
const pickValues = async (field: Locator, values: string[]) => {
  for (const value of values) {
    await userEvent.fill(field.getByRole('combobox'), value);
    await userEvent.click(
      page.getByRole('option', { name: value, exact: true })
    );

    await expect
      .element(
        field
          .getByTestId('autocomplete-selected-item')
          .filter({ hasText: value })
      )
      .toBeVisible();
  }
};

/** Clicks the dialog or drawer title so an open listbox stops covering it. */
const closeListbox = (scope: Locator) =>
  userEvent.click(scope.getByRole('heading', { includeHidden: true }).first());

const replaceText = async (editor: Locator, text: string) => {
  await userEvent.click(editor);
  await userEvent.keyboard('{ControlOrMeta>}a{/ControlOrMeta}{Backspace}');
  await userEvent.keyboard(text);
};

/** What `customPropertyConfig.config` the add form sends for the spec's config. */
const configSent = ({ config = {} }: PropertyKind) => {
  if (config.enum) {
    return { multiSelect: false, values: config.enum };
  }
  if (config.columns) {
    return { columns: config.columns };
  }
  if (config.entityReferences) {
    return config.entityReferences.map((label) => label.toLowerCase());
  }

  return config.format;
};

const createProperty = async (
  types: TypeServer,
  kind: PropertyKind,
  name: string
) => {
  await userEvent.click(page.getByTestId('add-field-button'));

  await expect.element(drawer().getByTestId('create-button')).toBeDisabled();

  await userEvent.click(page.getByTestId('show-side-panel-switch'));
  const nameInput = form()
    .getByTestId('custom-property-name')
    .getByRole('textbox');
  await userEvent.fill(nameInput, 'name:with:colon');

  await expect.element(form().getByText(NAME_ERROR)).toBeVisible();

  await userEvent.fill(nameInput, name);
  await userEvent.fill(
    form().getByTestId('custom-property-display-name').getByRole('textbox'),
    name
  );
  await choose(form().getByTestId('custom-property-type'), kind.label);

  const { config = {} } = kind;
  if (config.enum) {
    await addValues(
      form().getByTestId('custom-property-enum-config'),
      config.enum
    );
  }
  if (config.columns) {
    await addValues(
      form().getByTestId('custom-property-columns'),
      config.columns
    );
  }
  if (config.entityReferences) {
    await pickValues(
      form().getByTestId('custom-property-entity-ref-config'),
      config.entityReferences
    );
    await closeListbox(drawer());
  }
  if (config.format) {
    await choose(
      form().getByTestId('custom-property-format-config'),
      config.format
    );
  }
  await replaceText(blockEditor(form()), `${kind.label} property`);
  await userEvent.click(drawer().getByTestId('create-button'));

  await expect.element(drawer()).not.toBeInTheDocument();
  await expect.element(row(name)).toBeVisible();

  const [added] = types.added;

  expect(types.added).toHaveLength(1);
  expect(added).toMatchObject({
    name,
    displayName: name,
    description: `<p>${kind.label} property</p>`,
    propertyType: { type: 'type' },
  });
  expect(added.customPropertyConfig).toEqual(
    configSent(kind) && { config: configSent(kind) }
  );
};

const editProperty = async (
  types: TypeServer,
  kind: PropertyKind,
  name: string
) => {
  const { config = {} } = kind;
  await userEvent.click(row(name).getByTestId('property-actions'));
  await userEvent.click(page.getByRole('menuitem', { name: 'Edit' }));
  const dialog = page.getByTestId('edit-custom-property-modal');

  await expect.element(dialog).toBeVisible();

  await userEvent.fill(
    dialog
      .getByTestId('edit-custom-property-display-name')
      .getByRole('textbox'),
    name.toUpperCase()
  );
  await replaceText(blockEditor(dialog), DESCRIPTION);
  if (config.enum) {
    await addValues(dialog.getByTestId('edit-custom-property-enum-config'), [
      'updatedValue',
    ]);
  }
  if (config.entityReferences) {
    await pickValues(
      dialog.getByTestId('edit-custom-property-entity-ref-config'),
      ['Table']
    );
    await closeListbox(dialog);
  }
  await userEvent.click(dialog.getByTestId('edit-custom-property-save'));

  await expect.element(dialog).not.toBeInTheDocument();
  await expect
    .element(row(name).getByTestId('property-description'))
    .toHaveTextContent(DESCRIPTION);

  const saved = types.current().customProperties?.[0] as CustomProperty;

  expect(types.patches).toHaveLength(1);
  expect(saved.displayName).toBe(name.toUpperCase());
  expect(saved.description).toBe(`<p>${DESCRIPTION}</p>`);

  // The row lists the first three config values and counts the rest.
  if (config.enum) {
    await expect
      .poll(() =>
        row(name)
          .getByTestId('enum-config')
          .getByTestId('config-value')
          .all()
          .map((v) => v.element().textContent)
      )
      .toEqual(config.enum);
    await expect
      .element(
        row(name).getByTestId('enum-config').getByTestId('config-hidden-count')
      )
      .toHaveTextContent('+1');
  }
  if (config.entityReferences) {
    const cell = row(name).getByTestId(`${name}-config`);

    await expect
      .poll(() =>
        cell
          .getByTestId('config-value')
          .all()
          .map((v) => v.element().textContent)
      )
      .toEqual(config.entityReferences);
    await expect
      .element(cell.getByTestId('config-hidden-count'))
      .toHaveTextContent('+1');
  }
  if (config.columns) {
    for (const column of config.columns) {
      await expect
        .element(
          row(name)
            .getByTestId('table-config')
            .getByTestId('config-value')
            .filter({ hasText: column })
        )
        .toBeVisible();
    }
  }
};

const deleteProperty = async (types: TypeServer, name: string) => {
  await userEvent.click(row(name).getByTestId('property-actions'));
  await userEvent.click(page.getByRole('menuitem', { name: 'Delete' }));
  const dialog = page.getByRole('dialog', { name: 'Delete Property' });

  await expect.element(dialog.getByTestId('body-text')).toHaveTextContent(name);

  await userEvent.click(dialog.getByTestId('save-button'));

  await expect.element(row(name)).not.toBeInTheDocument();
  expect(types.current().customProperties).toEqual([]);
};

/**
 * Describes create → edit → find in advanced search → delete for each kind
 * on `entity`'s settings page.
 */
export const describeCustomPropertySettings = (
  entity: SettingsEntity,
  kinds: PropertyKind[]
) => {
  const advancedSearchGroup =
    entity.entityType.charAt(0).toUpperCase() + entity.entityType.slice(1);

  describe(
    `Custom properties of ${entity.entityType}`,
    { timeout: 90_000 },
    () => {
      test.each(kinds)(
        '$label: create, edit, find in advanced search, delete',
        async (kind) => {
          const name = `cp-${kind.type}-${entity.entityType}${NAME_SUFFIX}`;
          const types = serveEntityType(entity.entityType);
          const settings = `/settings/customProperties/${entity.path}`;
          let screen = await renderApp(settings);

          await expect
            .element(page.getByTestId('add-field-button'), { timeout: 60_000 })
            .toBeVisible();

          await createProperty(types, kind, name);
          await editProperty(types, kind, name);

          if (kind.searchFields) {
            serveSearch({});
            await screen.unmount();
            screen = await renderApp('/explore/tables');

            await expect
              .element(page.getByRole('button', { name: 'Tools' }), {
                timeout: 60_000,
              })
              .toBeVisible();

            await openAdvancedSearch();
            await pickField(0, ['Custom Properties']);
            // As in the spec: table-column properties stop at the group.
            if (entity.entityType !== 'tableColumn') {
              await pickField(0, [advancedSearchGroup], 1);
              for (const field of kind.searchFields(name.toUpperCase())) {
                await pickField(0, [field], 2);
              }
            }
            await userEvent.click(page.getByTestId('cancel-btn'));

            await expect.element(modal()).not.toBeInTheDocument();

            await screen.unmount();
            screen = await renderApp(settings);
          }

          await deleteProperty(types, name);
        }
      );
    }
  );
};
