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
import { AppModule } from '../../../../../../../interface/app-module.interface';
import {
  createDocument,
  updateDocument,
} from '../../../../../../../rest/DocStoreAPI';
import leftSidebarClassBase from '../../../../../../../utils/LeftSidebarClassBase';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../../utils/ToastUtils';
import {
  APP_MODE_SIDEBAR_CUSTOMIZATION_CHANGED_EVENT,
  APP_MODE_SIDEBAR_CUSTOMIZATION_KEY,
} from '../../../../../../platform/ai-shell/Sidebar/appModeSidebar.constants';
import AiSidebarEditor from './AiSidebarEditor';
import { CustomizeEditorActions } from './customizeEditor.types';

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

const Icon = () => null;

const buildModule = (overrides: Partial<AppModule>): AppModule => ({
  id: 'module',
  navOrder: 1,
  labelKey: 'label.module',
  prefix: '/module',
  defaultPath: '/module',
  routes: [],
  icon: Icon,
  ...overrides,
});

const persona = { id: 'persona-id', name: 'analyst' } as Persona;

const buildDocument = (overrides: Partial<Document> = {}): Document => ({
  name: 'analyst',
  fullyQualifiedName: 'persona.analyst',
  entityType: 'PersonaPreferences',
  data: {},
  ...overrides,
});

const onActionsChange = jest.fn();
const onDocumentSaved = jest.fn();

const latestActions = (): CustomizeEditorActions =>
  onActionsChange.mock.calls[onActionsChange.mock.calls.length - 1][0];

const renderEditor = (document: Document = buildDocument()) =>
  render(
    <AiSidebarEditor
      document={document}
      persona={persona}
      onActionsChange={onActionsChange}
      onDocumentSaved={onDocumentSaved}
    />
  );

describe('AiSidebarEditor', () => {
  const originalModules = leftSidebarClassBase.getAppModeModules();

  beforeEach(() => {
    leftSidebarClassBase.setAppModeModules([
      buildModule({
        id: 'home',
        labelKey: 'label.home',
        disablePersonaHide: true,
      }),
      buildModule({ id: 'explore', labelKey: 'label.explore', navOrder: 2 }),
      buildModule({ id: 'glossary', labelKey: 'label.glossary', navOrder: 3 }),
    ]);
  });

  afterEach(() => {
    leftSidebarClassBase.setAppModeModules(originalModules);
  });

  const exploreSwitch = () =>
    screen.getByRole('switch', { name: 'label.explore' });

  const storedNavigation = (hidden: string[] = []): NavigationItem[] =>
    ['home', 'explore', 'glossary'].map((id) => ({
      id,
      pageId: id,
      title: `label.${id}`,
      isHidden: hidden.includes(id),
    }));

  it('renders every app module plus the More group, all visible by default', () => {
    renderEditor();

    expect(screen.getByTestId('ai-sidebar-editor')).toBeInTheDocument();
    expect(exploreSwitch()).toBeChecked();
    expect(
      screen.getByRole('switch', { name: 'label.glossary' })
    ).toBeChecked();
    expect(screen.getByRole('switch', { name: 'label.more' })).toBeChecked();
    expect(latestActions()).toEqual(
      expect.objectContaining({ canSave: false, isSaving: false })
    );
  });

  it('locks the visibility toggle of modules that cannot be hidden', () => {
    renderEditor();

    expect(screen.getByRole('switch', { name: 'label.home' })).toBeDisabled();
    expect(exploreSwitch()).toBeEnabled();
  });

  it('reflects hidden items persisted in the document', () => {
    renderEditor(
      buildDocument({
        data: {
          [APP_MODE_SIDEBAR_CUSTOMIZATION_KEY]: storedNavigation(['explore']),
        },
      })
    );

    expect(exploreSwitch()).not.toBeChecked();
    expect(
      screen.getByRole('switch', { name: 'label.glossary' })
    ).toBeChecked();
    expect(latestActions().canSave).toBe(false);
  });

  it('marks the editor dirty when a toggle changes and clean when reverted', () => {
    renderEditor();

    fireEvent.click(exploreSwitch());

    expect(exploreSwitch()).not.toBeChecked();
    expect(latestActions().canSave).toBe(true);

    fireEvent.click(exploreSwitch());

    expect(latestActions().canSave).toBe(false);
  });

  it('resets to the default sidebar, discarding persisted hidden items', () => {
    renderEditor(
      buildDocument({
        data: {
          [APP_MODE_SIDEBAR_CUSTOMIZATION_KEY]: storedNavigation(['explore']),
        },
      })
    );

    act(() => latestActions().onReset());

    expect(exploreSwitch()).toBeChecked();
    expect(latestActions().canSave).toBe(true);
  });

  it('saves the sidebar into a new document and notifies listeners', async () => {
    const saved = buildDocument({ id: 'new-id' });
    const listener = jest.fn();
    (createDocument as jest.Mock).mockResolvedValue(saved);
    window.addEventListener(
      APP_MODE_SIDEBAR_CUSTOMIZATION_CHANGED_EVENT,
      listener
    );
    renderEditor();

    fireEvent.click(exploreSwitch());
    await act(async () => {
      await latestActions().onSave();
    });

    window.removeEventListener(
      APP_MODE_SIDEBAR_CUSTOMIZATION_CHANGED_EVENT,
      listener
    );
    const sidebar: NavigationItem[] = (createDocument as jest.Mock).mock
      .calls[0][0].data[APP_MODE_SIDEBAR_CUSTOMIZATION_KEY];

    expect(sidebar.map(({ id, isHidden }) => ({ id, isHidden }))).toEqual([
      { id: 'home', isHidden: false },
      { id: 'explore', isHidden: true },
      { id: 'glossary', isHidden: false },
      { id: 'more', isHidden: false },
    ]);
    expect(updateDocument).not.toHaveBeenCalled();
    expect(onDocumentSaved).toHaveBeenCalledWith(saved);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(showSuccessToast).toHaveBeenCalled();
  });

  it('patches an existing document', async () => {
    const document = buildDocument({ id: 'doc-id' });
    (updateDocument as jest.Mock).mockResolvedValue(document);
    renderEditor(document);

    fireEvent.click(exploreSwitch());
    await act(async () => {
      await latestActions().onSave();
    });

    expect(updateDocument).toHaveBeenCalledWith(
      'doc-id',
      expect.arrayContaining([
        expect.objectContaining({
          path: `/data/${APP_MODE_SIDEBAR_CUSTOMIZATION_KEY}`,
        }),
      ])
    );
    expect(createDocument).not.toHaveBeenCalled();
    expect(onDocumentSaved).toHaveBeenCalledWith(document);
  });

  it('shows an error and does not notify listeners when saving fails', async () => {
    const error = new Error('boom');
    const listener = jest.fn();
    (createDocument as jest.Mock).mockRejectedValue(error);
    window.addEventListener(
      APP_MODE_SIDEBAR_CUSTOMIZATION_CHANGED_EVENT,
      listener
    );
    renderEditor();

    fireEvent.click(exploreSwitch());
    await act(async () => {
      await latestActions().onSave();
    });

    window.removeEventListener(
      APP_MODE_SIDEBAR_CUSTOMIZATION_CHANGED_EVENT,
      listener
    );

    expect(showErrorToast).toHaveBeenCalledWith(error);
    expect(onDocumentSaved).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    expect(latestActions()).toEqual(
      expect.objectContaining({ canSave: true, isSaving: false })
    );
  });
});
