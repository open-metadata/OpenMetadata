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
import { Document } from '../../../../../../../generated/entity/docStore/document';
import { Persona } from '../../../../../../../generated/entity/teams/persona';
import { NavigationItem } from '../../../../../../../generated/system/ui/uiCustomization';
import {
    createDocument,
    updateDocument
} from '../../../../../../../rest/DocStoreAPI';
import { getTreeDataForNavigationItems } from '../../../../../../../utils/CustomizaNavigation/CustomizeNavigation';
import { getNavigationItems } from '../../../../../../../utils/SettingsNavigationPageUtils';
import {
    showErrorToast,
    showSuccessToast
} from '../../../../../../../utils/ToastUtils';
import { CustomizeEditorActions } from './customizeEditor.types';
import NavigationEditor from './NavigationEditor';

jest.mock(
  '../../../../../../Settings/Applications/ApplicationsProvider/ApplicationsProvider',
  () => ({
    useApplicationsProvider: () => ({ plugins: [] }),
  })
);

jest.mock('../../../../../../../rest/DocStoreAPI', () => ({
  createDocument: jest.fn(),
  updateDocument: jest.fn(),
}));

jest.mock('../../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

const persona = { id: 'persona-id', name: 'analyst' } as Persona;

const buildDocument = (overrides: Partial<Document> = {}): Document => ({
  name: 'analyst',
  fullyQualifiedName: 'persona.analyst',
  entityType: 'PersonaPreferences',
  data: {},
  ...overrides,
});

const defaultTree = getTreeDataForNavigationItems(null, []);
const exploreKey = String(
  defaultTree.find((node) => node.title === 'label.explore')?.key
);

const findItem = (
  items: NavigationItem[],
  id: string
): NavigationItem | undefined =>
  items.find((item) => item.id === id) ??
  items.map((item) => findItem(item.children ?? [], id)).find(Boolean);

const onActionsChange = jest.fn();
const onDocumentSaved = jest.fn();

const latestActions = (): CustomizeEditorActions =>
  onActionsChange.mock.calls[onActionsChange.mock.calls.length - 1][0];

const renderEditor = (document: Document = buildDocument()) =>
  render(
    <NavigationEditor
      document={document}
      persona={persona}
      onActionsChange={onActionsChange}
      onDocumentSaved={onDocumentSaved}
    />
  );

const exploreSwitch = () =>
  screen.getByRole('switch', { name: 'label.explore' });

describe('NavigationEditor', () => {
  it('renders every default nav item visible with nothing to save', () => {
    renderEditor();

    expect(screen.getByTestId('navigation-editor')).toBeInTheDocument();
    expect(exploreSwitch()).toBeChecked();
    expect(
      screen.getByRole('switch', { name: 'label.data-quality' })
    ).toBeChecked();
    expect(latestActions()).toEqual(
      expect.objectContaining({ canSave: false, isSaving: false })
    );
  });

  it('reflects hidden items persisted in the document', () => {
    renderEditor(
      buildDocument({
        data: { navigation: getNavigationItems(defaultTree, [exploreKey]) },
      })
    );

    expect(exploreSwitch()).not.toBeChecked();
    expect(latestActions().canSave).toBe(false);
  });

  it('marks the editor dirty when a visibility toggle changes and clean when reverted', () => {
    renderEditor();

    fireEvent.click(exploreSwitch());

    expect(exploreSwitch()).not.toBeChecked();
    expect(latestActions().canSave).toBe(true);

    fireEvent.click(exploreSwitch());

    expect(exploreSwitch()).toBeChecked();
    expect(latestActions().canSave).toBe(false);
  });

  it('resets to the default navigation, discarding persisted hidden items', () => {
    renderEditor(
      buildDocument({
        data: { navigation: getNavigationItems(defaultTree, [exploreKey]) },
      })
    );

    act(() => latestActions().onReset());

    expect(exploreSwitch()).toBeChecked();
    expect(latestActions().canSave).toBe(true);
  });

  it('creates the document with the edited navigation when none exists yet', async () => {
    const saved = buildDocument({ id: 'new-id' });
    (createDocument as jest.Mock).mockResolvedValue(saved);
    renderEditor();

    fireEvent.click(exploreSwitch());
    await act(async () => {
      await latestActions().onSave();
    });

    const payload = (createDocument as jest.Mock).mock.calls[0][0];

    expect(findItem(payload.data.navigation, exploreKey)?.isHidden).toBe(true);
    expect(updateDocument).not.toHaveBeenCalled();
    expect(onDocumentSaved).toHaveBeenCalledWith(saved);
    expect(showSuccessToast).toHaveBeenCalled();
    expect(latestActions().isSaving).toBe(false);
  });

  it('patches an existing document', async () => {
    const saved = buildDocument({ id: 'doc-id' });
    (updateDocument as jest.Mock).mockResolvedValue(saved);
    renderEditor(buildDocument({ id: 'doc-id' }));

    fireEvent.click(exploreSwitch());
    await act(async () => {
      await latestActions().onSave();
    });

    expect(updateDocument).toHaveBeenCalledWith(
      'doc-id',
      expect.arrayContaining([
        expect.objectContaining({ path: '/data/navigation' }),
      ])
    );
    expect(createDocument).not.toHaveBeenCalled();
    expect(onDocumentSaved).toHaveBeenCalledWith(saved);
  });

  it('shows an error and does not report a saved document when saving fails', async () => {
    const error = new Error('boom');
    (createDocument as jest.Mock).mockRejectedValue(error);
    renderEditor();

    fireEvent.click(exploreSwitch());
    await act(async () => {
      await latestActions().onSave();
    });

    expect(showErrorToast).toHaveBeenCalledWith(error);
    expect(onDocumentSaved).not.toHaveBeenCalled();
    expect(latestActions()).toEqual(
      expect.objectContaining({ canSave: true, isSaving: false })
    );
  });
});
