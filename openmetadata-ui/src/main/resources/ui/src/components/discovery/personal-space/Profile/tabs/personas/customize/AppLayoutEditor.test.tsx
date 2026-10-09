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

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { applyPatch, Operation } from 'fast-json-patch';
import { cloneDeep } from 'lodash';
import { Document } from '../../../../../../../generated/entity/docStore/document';
import { Persona } from '../../../../../../../generated/entity/teams/persona';
import {
    AppMode,
    PageViewMode,
    PersonaPreferences
} from '../../../../../../../generated/type/personaPreferences';
import {
    createDocument,
    updateDocument
} from '../../../../../../../rest/DocStoreAPI';
import {
    showErrorToast,
    showSuccessToast
} from '../../../../../../../utils/ToastUtils';
import AppLayoutEditor from './AppLayoutEditor';
import { CustomizeEditorActions } from './customizeEditor.types';

jest.mock('../../../../../../../rest/DocStoreAPI', () => ({
  createDocument: jest.fn(),
  updateDocument: jest.fn(),
}));

jest.mock('../../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const persona = { id: 'persona-id', name: 'analyst' } as Persona;

const buildDocument = (
  preferences?: Partial<PersonaPreferences>,
  id?: string
): Document => ({
  id,
  name: 'analyst',
  fullyQualifiedName: 'persona.analyst',
  entityType: 'PersonaPreferences',
  data: preferences
    ? {
        personaPreferences: [
          { personaId: persona.id, personaName: persona.name, ...preferences },
        ],
      }
    : {},
});

const onActionsChange = jest.fn();
const onDocumentSaved = jest.fn();

const latestActions = (): CustomizeEditorActions =>
  onActionsChange.mock.calls[onActionsChange.mock.calls.length - 1][0];

const renderEditor = (document: Document = buildDocument()) =>
  render(
    <AppLayoutEditor
      document={document}
      persona={persona}
      onActionsChange={onActionsChange}
      onDocumentSaved={onDocumentSaved}
    />
  );

const save = async () => {
  await act(async () => {
    await latestActions().onSave();
  });
};

const createdPreferences = (): PersonaPreferences[] =>
  (createDocument as jest.Mock).mock.calls[0][0].data.personaPreferences;

const patchedPreferences = (document: Document): PersonaPreferences[] => {
  const [, ops] = (updateDocument as jest.Mock).mock.calls[0] as [
    string,
    Operation[]
  ];

  return applyPatch(cloneDeep(document), ops).newDocument.data
    .personaPreferences;
};

describe('AppLayoutEditor', () => {
  it('starts from "no default" with no page view modes when nothing is persisted', () => {
    renderEditor();

    expect(
      screen.getByRole('radio', { name: /label.no-default/ })
    ).toBeChecked();
    expect(screen.queryByTestId(/^view-mode-row-/)).not.toBeInTheDocument();
    expect(latestActions()).toEqual(
      expect.objectContaining({ canSave: false, isSaving: false })
    );
  });

  it('renders the persona preferences persisted in the document', () => {
    renderEditor(
      buildDocument({
        appMode: AppMode.AI,
        defaultLandingPage: '/explore',
        defaultViewModes: { domains: PageViewMode.Card },
      })
    );

    expect(
      screen.getByRole('radio', { name: /label.app-mode-ai/ })
    ).toBeChecked();
    expect(
      within(screen.getByTestId('default-landing-page-select')).getByText(
        'label.explore'
      )
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('view-mode-row-domains')).getByRole('tab', {
        name: 'label.grid',
      })
    ).toHaveAttribute('aria-selected', 'true');
    expect(latestActions().canSave).toBe(false);
  });

  it('saves a newly chosen app mode into a new document', async () => {
    const saved = buildDocument({ appMode: AppMode.AI }, 'new-id');
    (createDocument as jest.Mock).mockResolvedValue(saved);
    renderEditor();

    fireEvent.click(screen.getByRole('radio', { name: /label.app-mode-ai/ }));

    expect(latestActions().canSave).toBe(true);

    await save();

    expect(createdPreferences()).toEqual([
      { personaId: persona.id, personaName: persona.name, appMode: AppMode.AI },
    ]);
    expect(onDocumentSaved).toHaveBeenCalledWith(saved);
    expect(showSuccessToast).toHaveBeenCalled();
  });

  it('becomes clean again when the selection is reverted', () => {
    renderEditor(buildDocument({ appMode: AppMode.Classic }));

    fireEvent.click(screen.getByRole('radio', { name: /label.app-mode-ai/ }));

    expect(latestActions().canSave).toBe(true);

    fireEvent.click(
      screen.getByRole('radio', { name: /label.app-mode-classic/ })
    );

    expect(latestActions().canSave).toBe(false);
  });

  it('changes and removes per-page view modes, patching the existing document', async () => {
    const document = buildDocument(
      {
        appMode: AppMode.Classic,
        defaultViewModes: {
          domains: PageViewMode.Table,
          dataProducts: PageViewMode.Table,
        },
      },
      'doc-id'
    );
    (updateDocument as jest.Mock).mockResolvedValue(document);
    renderEditor(document);

    fireEvent.click(
      within(screen.getByTestId('view-mode-row-domains')).getByRole('tab', {
        name: 'label.tree',
      })
    );
    fireEvent.click(screen.getByTestId('remove-view-mode-dataProducts'));

    expect(
      screen.queryByTestId('view-mode-row-dataProducts')
    ).not.toBeInTheDocument();
    expect(latestActions().canSave).toBe(true);

    await save();

    expect(createDocument).not.toHaveBeenCalled();
    expect(patchedPreferences(document)).toEqual([
      {
        personaId: persona.id,
        personaName: persona.name,
        appMode: AppMode.Classic,
        defaultViewModes: { domains: PageViewMode.Tree },
      },
    ]);
  });

  it('adds a page with the default table view from the add-page menu', () => {
    renderEditor();

    fireEvent.click(screen.getByTestId('add-view-mode-page'));
    fireEvent.click(
      screen.getByRole('menuitem', { name: 'label.learning-resources' })
    );

    expect(
      within(screen.getByTestId('view-mode-row-learningResources')).getByRole(
        'tab',
        { name: 'label.table' }
      )
    ).toHaveAttribute('aria-selected', 'true');
    expect(latestActions().canSave).toBe(true);
  });

  it('saves a chosen default landing page', async () => {
    (createDocument as jest.Mock).mockResolvedValue(buildDocument());
    renderEditor();

    fireEvent.click(
      within(screen.getByTestId('default-landing-page-select')).getByRole(
        'button'
      )
    );
    fireEvent.click(screen.getByRole('option', { name: /label.glossary/ }));

    expect(latestActions().canSave).toBe(true);

    await save();

    expect(createdPreferences()).toEqual([
      {
        personaId: persona.id,
        personaName: persona.name,
        defaultLandingPage: '/glossary',
      },
    ]);
  });

  it('resets every preference back to the defaults', () => {
    renderEditor(
      buildDocument({
        appMode: AppMode.AI,
        defaultViewModes: { domains: PageViewMode.Card },
      })
    );

    act(() => latestActions().onReset());

    expect(
      screen.getByRole('radio', { name: /label.no-default/ })
    ).toBeChecked();
    expect(
      screen.queryByTestId('view-mode-row-domains')
    ).not.toBeInTheDocument();
    expect(latestActions().canSave).toBe(true);
  });

  it('shows an error and keeps the edit when saving fails', async () => {
    const error = new Error('boom');
    (createDocument as jest.Mock).mockRejectedValue(error);
    renderEditor();

    fireEvent.click(screen.getByRole('radio', { name: /label.app-mode-ai/ }));
    await save();

    expect(showErrorToast).toHaveBeenCalledWith(error);
    expect(onDocumentSaved).not.toHaveBeenCalled();
    expect(latestActions()).toEqual(
      expect.objectContaining({ canSave: true, isSaving: false })
    );
  });
});
