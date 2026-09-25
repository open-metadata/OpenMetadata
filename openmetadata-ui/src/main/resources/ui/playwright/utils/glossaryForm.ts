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
 * The one place Playwright drives the Add Glossary and Add / Edit Glossary
 * Term drawers. Specs open a form, fill it from a plain field object and save
 * it through these helpers instead of reaching for form test ids directly, so
 * a change to either form is absorbed here.
 *
 * Both drawers are SlideoutMenus mounted over the glossary page, which keeps
 * its own description editor, tag pickers and owner widgets — so every field
 * is resolved through the form container, never off `page`.
 */
import { expect, Locator, Page, Response } from '@playwright/test';
import { isUndefined } from 'lodash';
import { INVALID_NAMES, NAME_VALIDATION_ERROR } from '../constant/common';
import { fillDescriptionBox, getDescriptionBox } from './common';
import { GlossaryTermRef, pickGlossaryTermInField } from './glossaryPicker';

export type GlossaryFormKind = 'glossary' | 'glossaryTerm';

export type GlossaryTermFormMode = 'Add Glossary Term' | 'Edit Glossary Term';

export type GlossaryFormOptionField = 'owners' | 'reviewers' | 'domains';

export interface GlossaryFormReference {
  name: string;
  endpoint: string;
}

export interface GlossaryFormFields {
  name?: string;
  displayName?: string;
  description?: string;
  /** Tag FQNs, e.g. `PersonalData.Personal`. */
  tags?: string[];
  mutuallyExclusive?: boolean;
  /** Display or login names; users and teams share one option list. */
  owners?: string[];
  reviewers?: string[];
}

export interface AddGlossaryFormFields extends GlossaryFormFields {
  domains?: string[];
}

export interface GlossaryTermFormFields extends GlossaryFormFields {
  synonyms?: string[];
  relatedTerms?: GlossaryTermRef[];
  references?: GlossaryFormReference[];
  /** An icon from the picker grid, or a custom icon URL. */
  icon?: { name: string } | { url: string };
  /** One of ENTITY_PALETTE_HEX (uppercase): the colour field is a swatch palette. */
  color?: string;
}

export const GLOSSARY_NAME_SIZE_ERROR = 'Name size must be between 1 and 128';

const DRAWER = {
  glossary: {
    drawer: 'add-glossary-drawer',
    form: 'add-glossary-form',
    save: 'save-glossary',
    cancel: 'cancel-glossary',
  },
  glossaryTerm: {
    drawer: 'glossary-term-drawer',
    form: 'add-glossary-term-form',
    save: 'save-glossary-term',
    cancel: 'cancel-glossary-term',
  },
} as const;

// ---------------------------------------------------------------------------
// Locators
// ---------------------------------------------------------------------------

export const getGlossaryFormDrawer = (page: Page, kind: GlossaryFormKind) =>
  page.getByTestId(DRAWER[kind].drawer);

export const getAddGlossaryDrawer = (page: Page) =>
  getGlossaryFormDrawer(page, 'glossary');

export const getGlossaryTermDrawer = (page: Page) =>
  getGlossaryFormDrawer(page, 'glossaryTerm');

export const getGlossaryForm = (page: Page) =>
  page.getByTestId(DRAWER.glossary.form);

export const getGlossaryTermForm = (page: Page) =>
  page.getByTestId(DRAWER.glossaryTerm.form);

// Core `Input` puts `data-testid` on the wrapper; the `<input>` carries the id.
export const getFormNameInput = (form: Locator) => form.locator('#root\\/name');

export const getFormDisplayNameInput = (form: Locator) =>
  form.locator('#root\\/displayName');

export const getReferenceNameInput = (form: Locator, index: number) =>
  form.locator(`#name-${index}`);

export const getReferenceUrlInput = (form: Locator, index: number) =>
  form.locator(`#url-${index}`);

export const getMutuallyExclusiveAlert = (form: Locator) =>
  form.getByTestId('form-item-alert');

export const getMutuallyExclusiveToggle = (form: Locator) =>
  form.getByTestId('mutually-exclusive-button');

/** The owners / reviewers / domains picker; selected options render as chips in it. */
export const getGlossaryFormOptionField = (
  form: Locator,
  field: GlossaryFormOptionField
) => form.getByTestId(field);

// ---------------------------------------------------------------------------
// Open
// ---------------------------------------------------------------------------

/** Opens the Add Glossary drawer from the left panel or the empty state. */
export const openAddGlossaryForm = async (page: Page) => {
  // The left-panel button and the empty-state button never render together.
  await page.getByTestId('add-glossary').click();

  await expect(
    getAddGlossaryDrawer(page).getByTestId('form-heading')
  ).toHaveText('Add Glossary');
  await expect(getGlossaryForm(page)).toBeVisible();

  return getGlossaryForm(page);
};

/**
 * Waits for the term drawer and its form. The form mounts only once the
 * intake form (and, in edit mode, the term) has loaded — a Loader stands in
 * until then.
 */
export const waitForGlossaryTermForm = async (
  page: Page,
  mode: GlossaryTermFormMode
) => {
  await expect(
    getGlossaryTermDrawer(page).getByTestId('form-heading')
  ).toHaveText(mode);
  await expect(getGlossaryTermForm(page)).toBeVisible();

  return getGlossaryTermForm(page);
};

/**
 * Opens the Add Glossary Term drawer.
 * - `header` (default): the glossary / term header "Add term" button.
 * - `placeholder`: the empty-terms placeholder button.
 */
export const openAddGlossaryTermForm = async (
  page: Page,
  { from = 'header' }: { from?: 'header' | 'placeholder' } = {}
) => {
  await page
    .getByTestId(
      from === 'placeholder'
        ? 'add-placeholder-button'
        : 'add-new-tag-button-header'
    )
    .click();

  return waitForGlossaryTermForm(page, 'Add Glossary Term');
};

const escapeFqnForSelector = (fqn: string) =>
  fqn.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const getTermRow = (page: Page, termFqn: string) =>
  page.locator(`[data-row-key="${escapeFqnForSelector(termFqn)}"]`);

/** Opens the Add Glossary Term drawer from a term row's "+" action (child term). */
export const openAddChildGlossaryTermForm = async (
  page: Page,
  parentFqn: string
) => {
  await getTermRow(page, parentFqn).getByTestId('add-classification').click();

  return waitForGlossaryTermForm(page, 'Add Glossary Term');
};

/** Opens the Edit Glossary Term drawer from a row of the terms table. */
export const openEditGlossaryTermForm = async (page: Page, termFqn: string) => {
  const termRow = getTermRow(page, termFqn);
  const glossaryTermResponse = page.waitForResponse(
    '/api/v1/glossaryTerms/name/*'
  );
  // The row's edit action only renders on hover.
  await termRow.hover();
  await termRow.getByTestId('edit-button').click();
  await glossaryTermResponse;

  return waitForGlossaryTermForm(page, 'Edit Glossary Term');
};

// ---------------------------------------------------------------------------
// Field-level helpers
// ---------------------------------------------------------------------------

/**
 * Pick options in a search-backed core Autocomplete (`owners` / `reviewers` /
 * `domains`).
 *
 * Focus loads an unfiltered page of options and typing re-queries after a
 * debounce, so the unfiltered response can land after the filtered one and
 * replace it. Retyping until the option shows covers that race and ES
 * indexing lag for freshly created entities. Options carry the display name
 * with the FQN as supporting text, so a login name matches too.
 */
export const selectGlossaryFormOptions = async (
  page: Page,
  form: Locator,
  field: GlossaryFormOptionField,
  names: string[]
) => {
  const input = form.getByTestId(field).getByRole('combobox');

  for (const name of names) {
    const option = page.getByRole('option').filter({ hasText: name });

    await expect(async () => {
      await input.click();
      await input.fill('');
      await input.fill(name);
      await expect(option).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000 });

    await option.click();

    // Selected options drop out of the list, which confirms the pick.
    await expect(option).toBeHidden();
  }

  // Closes the listbox only: the drawer disables keyboard dismissal.
  await input.press('Escape');
};

/**
 * Pick a tag in the form's `TagSelector` (a core FilterSelect in
 * immediate-commit mode). Clicking outside would dismiss the drawer itself,
 * so the popover is closed with Escape.
 */
export const selectTagInGlossaryForm = async (
  page: Page,
  form: Locator,
  tagFqn: string
) => {
  const menu = page.getByTestId('drop-down-menu');

  await form.getByTestId('tags-container').click();
  await expect(menu).toBeVisible();

  const tagSearchResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/search/query') &&
      response.url().includes('index=tag') &&
      response.request().method() === 'GET'
  );
  await menu.getByTestId('search-input').fill(tagFqn);
  await tagSearchResponse;

  await menu.getByTestId(tagFqn).click();
  await page.keyboard.press('Escape');

  await expect(menu).toBeHidden();
  await expect(form.getByTestId('filter-chip')).not.toHaveCount(0);
};

export const addSynonymsInGlossaryTermForm = async (
  form: Locator,
  synonyms: string[]
) => {
  const synonymsField = form.getByTestId('synonyms');
  const synonymsInput = synonymsField.getByRole('combobox');

  for (const synonym of synonyms) {
    await synonymsInput.fill(synonym);
    await synonymsInput.press('Enter');

    await expect(synonymsField).toContainText(synonym);
  }
};

/** Appends reference rows after any rows the form already has. */
export const addReferencesInGlossaryTermForm = async (
  form: Locator,
  references: GlossaryFormReference[]
) => {
  const addButton = form.getByTestId('add-reference');
  const firstIndex = await form.locator('[id^="name-"]').count();

  for (const [offset, reference] of references.entries()) {
    const index = firstIndex + offset;

    await addButton.click();
    await getReferenceNameInput(form, index).fill(reference.name);
    await getReferenceUrlInput(form, index).fill(reference.endpoint);
  }
};

/** Overwrites the given fields of an existing reference row. */
export const updateReferenceInGlossaryTermForm = async (
  form: Locator,
  index: number,
  reference: Partial<GlossaryFormReference>
) => {
  if (!isUndefined(reference.name)) {
    await getReferenceNameInput(form, index).fill(reference.name);
  }
  if (!isUndefined(reference.endpoint)) {
    await getReferenceUrlInput(form, index).fill(reference.endpoint);
  }
};

export const removeReferenceInGlossaryTermForm = async (
  form: Locator,
  index: number
) => {
  await form.getByTestId(`remove-reference-${index}`).click();
};

export const selectRelatedTermsInGlossaryTermForm = async (
  page: Page,
  form: Locator,
  terms: GlossaryTermRef[]
) => {
  for (const term of terms) {
    // Escape, not click-outside: an outside click dismisses the drawer.
    await pickGlossaryTermInField(
      page,
      form.getByTestId('related-terms'),
      term,
      {
        dismissWith: 'escape',
      }
    );
  }
};

/**
 * The icon field is a picker, not a text input: the trigger opens a popover
 * with an icon grid and a URL tab. Re-clicking the trigger closes the popover
 * so it cannot cover the drawer's Save button.
 */
export const selectStyleIcon = async (
  page: Page,
  form: Locator,
  iconName: string
) => {
  await form.getByTestId('icon-picker-btn').click();
  await page.getByRole('button', { name: iconName, exact: true }).click();
};

export const fillStyleIconUrl = async (
  page: Page,
  form: Locator,
  iconUrl: string
) => {
  const trigger = form.getByTestId('icon-picker-btn');

  await trigger.click();
  await page.getByRole('tab', { name: 'URL' }).click();

  const urlInput = page.getByRole('textbox', { name: 'Icon URL' });
  await urlInput.fill(iconUrl);

  await trigger.click();
  await expect(urlInput).not.toBeVisible();
};

export const selectStyleColor = async (form: Locator, color: string) => {
  await form.getByRole('button', { name: `Select color ${color}` }).click();
};

/** Sets the Mutually Exclusive toggle, checking the warning follows it. */
export const setMutuallyExclusive = async (form: Locator, enabled: boolean) => {
  const toggle = getMutuallyExclusiveToggle(form);
  const alert = getMutuallyExclusiveAlert(form);
  const isEnabled = await alert.isVisible();

  if (isEnabled !== enabled) {
    await toggle.click();
  }

  await expect(alert).toBeVisible({ visible: enabled });
};

export const replaceFormDescription = async (
  form: Locator,
  description: string
) => {
  const editor = getDescriptionBox(form);

  await expect(editor).toHaveCount(1);
  await editor.clear();
  await editor.fill(description);
};

// ---------------------------------------------------------------------------
// Fill
// ---------------------------------------------------------------------------

const fillSharedFields = async (
  page: Page,
  form: Locator,
  fields: GlossaryFormFields
) => {
  if (!isUndefined(fields.name)) {
    await getFormNameInput(form).fill(fields.name);
  }
  if (!isUndefined(fields.displayName)) {
    await getFormDisplayNameInput(form).fill(fields.displayName);
  }
  if (!isUndefined(fields.description)) {
    await fillDescriptionBox(form, fields.description);
  }
  for (const tag of fields.tags ?? []) {
    await selectTagInGlossaryForm(page, form, tag);
  }
  if (!isUndefined(fields.mutuallyExclusive)) {
    await setMutuallyExclusive(form, fields.mutuallyExclusive);
  }
  if (fields.owners?.length) {
    await selectGlossaryFormOptions(page, form, 'owners', fields.owners);
  }
  if (fields.reviewers?.length) {
    await selectGlossaryFormOptions(page, form, 'reviewers', fields.reviewers);
  }
};

/** Fills only the fields present in `fields`; the rest keep their value. */
export const fillGlossaryForm = async (
  page: Page,
  form: Locator,
  fields: AddGlossaryFormFields
) => {
  await fillSharedFields(page, form, fields);

  if (fields.domains?.length) {
    await selectGlossaryFormOptions(page, form, 'domains', fields.domains);
  }
};

/** Fills only the fields present in `fields`; the rest keep their value. */
export const fillGlossaryTermForm = async (
  page: Page,
  form: Locator,
  fields: GlossaryTermFormFields
) => {
  if (fields.icon) {
    await ('url' in fields.icon
      ? fillStyleIconUrl(page, form, fields.icon.url)
      : selectStyleIcon(page, form, fields.icon.name));
  }
  if (fields.color) {
    await selectStyleColor(form, fields.color);
  }

  await fillSharedFields(page, form, fields);

  if (fields.synonyms?.length) {
    await addSynonymsInGlossaryTermForm(form, fields.synonyms);
  }
  if (fields.relatedTerms?.length) {
    await selectRelatedTermsInGlossaryTermForm(page, form, fields.relatedTerms);
  }
  if (fields.references?.length) {
    await addReferencesInGlossaryTermForm(form, fields.references);
  }
};

// ---------------------------------------------------------------------------
// Submit / cancel
// ---------------------------------------------------------------------------

/**
 * Presses a drawer's Save button.
 *
 * The SlideoutMenu footer shifts while the form body re-renders, so a pointer
 * click can spin on Playwright's "stable" check (see clickDrawerSave in
 * domain.ts). The footer buttons are native <button>s: focus + Enter fires the
 * same press without a stable pointer target.
 */
export const pressGlossaryFormSave = async (
  page: Page,
  kind: GlossaryFormKind
) => {
  const saveButton = page.getByTestId(DRAWER[kind].save);

  await expect(saveButton).toBeEnabled();
  await saveButton.focus();
  await page.keyboard.press('Enter');
};

const isGlossaryCreate = (response: Response) =>
  response.url().endsWith('/api/v1/glossaries') &&
  response.request().method() === 'POST';

const isGlossaryTermCreate = (response: Response) =>
  response.url().endsWith('/api/v1/glossaryTerms') &&
  response.request().method() === 'POST';

const isGlossaryTermPatch = (response: Response) =>
  response.url().includes('/api/v1/glossaryTerms/') &&
  response.request().method() === 'PATCH';

/**
 * Saves the Add Glossary drawer and waits for the create call and the drawer
 * to close. Resolves the create response for payload assertions.
 */
export const saveGlossaryForm = async (page: Page) => {
  const createResponse = page.waitForResponse(isGlossaryCreate);
  await pressGlossaryFormSave(page, 'glossary');
  const response = await createResponse;

  await expect(getAddGlossaryDrawer(page)).toBeHidden();

  return response;
};

/**
 * Saves the term drawer and waits for the create (Add) or patch (Edit) call
 * and the drawer to close. Resolves that response for payload assertions.
 */
export const saveGlossaryTermForm = async (
  page: Page,
  mode: 'create' | 'edit' = 'create'
) => {
  const saveResponse = page.waitForResponse(
    mode === 'create' ? isGlossaryTermCreate : isGlossaryTermPatch
  );
  await pressGlossaryFormSave(page, 'glossaryTerm');
  const response = await saveResponse;

  await expect(getGlossaryTermDrawer(page)).toBeHidden();

  return response;
};

/**
 * Presses Save on a form expected to be rejected — by client validation or by
 * the server — and checks the drawer stays open with `message` in the form.
 */
export const saveGlossaryFormExpectingError = async (
  page: Page,
  kind: GlossaryFormKind,
  message?: string | RegExp
) => {
  await pressGlossaryFormSave(page, kind);

  await expect(getGlossaryFormDrawer(page, kind)).toBeVisible();

  if (message) {
    await expectGlossaryFormError(page, kind, message);
  }
};

export const cancelGlossaryForm = async (
  page: Page,
  kind: GlossaryFormKind
) => {
  await page.getByTestId(DRAWER[kind].cancel).click();

  await expect(getGlossaryFormDrawer(page, kind)).toBeHidden();
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const getFormByKind = (page: Page, kind: GlossaryFormKind) =>
  kind === 'glossary' ? getGlossaryForm(page) : getGlossaryTermForm(page);

export const expectGlossaryFormError = async (
  page: Page,
  kind: GlossaryFormKind,
  message: string | RegExp
) => {
  await expect(
    getFormByKind(page, kind).getByText(message, {
      exact: typeof message === 'string',
    })
  ).toBeVisible();
};

/**
 * Walks the required / length / pattern rules on the name and description.
 * Expects the form to have been submitted empty already.
 */
export const validateGlossaryFormRequiredFields = async (form: Locator) => {
  await expect(
    form.getByText('Name is required', { exact: true })
  ).toBeVisible();
  await expect(form.getByTestId('description')).toContainText(
    'Description is required'
  );

  const nameInput = getFormNameInput(form);

  await nameInput.fill(INVALID_NAMES.MAX_LENGTH);

  await expect(
    form.getByText(GLOSSARY_NAME_SIZE_ERROR, { exact: true })
  ).toBeVisible();

  await nameInput.fill(INVALID_NAMES.WITH_SPECIAL_CHARS);

  await expect(
    form.getByText(NAME_VALIDATION_ERROR, { exact: true })
  ).toBeVisible();
};

// ---------------------------------------------------------------------------
// End-to-end flows
// ---------------------------------------------------------------------------

/** Opens, fills and saves the Add Glossary drawer; resolves the create response. */
export const createGlossaryFromForm = async (
  page: Page,
  fields: AddGlossaryFormFields
) => {
  const form = await openAddGlossaryForm(page);
  await fillGlossaryForm(page, form, fields);

  return saveGlossaryForm(page);
};

/** Opens, fills and saves the Add Glossary Term drawer; resolves the create response. */
export const createGlossaryTermFromForm = async (
  page: Page,
  fields: GlossaryTermFormFields,
  options: { from?: 'header' | 'placeholder' } = {}
) => {
  const form = await openAddGlossaryTermForm(page, options);
  await fillGlossaryTermForm(page, form, fields);

  return saveGlossaryTermForm(page, 'create');
};

/** Opens a term's edit drawer, fills it and saves; resolves the patch response. */
export const editGlossaryTermFromForm = async (
  page: Page,
  termFqn: string,
  fields: GlossaryTermFormFields
) => {
  const form = await openEditGlossaryTermForm(page, termFqn);
  await fillGlossaryTermForm(page, form, fields);

  return saveGlossaryTermForm(page, 'edit');
};
