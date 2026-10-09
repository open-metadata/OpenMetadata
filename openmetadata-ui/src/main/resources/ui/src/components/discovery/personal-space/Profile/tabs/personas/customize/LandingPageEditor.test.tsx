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

import { act, render, screen } from '@testing-library/react';
import { EntityType } from '../../../../../../../enums/entity.enum';
import { Document } from '../../../../../../../generated/entity/docStore/document';
import { Persona } from '../../../../../../../generated/entity/teams/persona';
import {
    EntityType as PageEntityType,
    Page,
    PageType
} from '../../../../../../../generated/system/ui/page';
import { useCustomizeStore } from '../../../../../../../pages/CustomizablePage/CustomizeStore';
import {
    createDocument,
    updateDocument
} from '../../../../../../../rest/DocStoreAPI';
import {
    showErrorToast,
    showSuccessToast
} from '../../../../../../../utils/ToastUtils';
import { CustomizeEditorActions } from './customizeEditor.types';
import LandingPageEditor from './LandingPageEditor';

interface MockCustomizeMyDataProps {
  backgroundColor?: string;
  initialPageData: Page | null;
  onBackgroundColorUpdate?: (color?: string) => Promise<void>;
  onSaveLayout: (page?: Page) => Promise<void>;
}

let mockCustomizeMyDataProps: MockCustomizeMyDataProps | undefined;

jest.mock('../../../../../../../rest/DocStoreAPI', () => ({
  createDocument: jest.fn(),
  updateDocument: jest.fn(),
}));

jest.mock('../../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock(
  '../../../../../../MyData/CustomizableComponents/CustomizeMyData/CustomizeMyData',
  () => (props: MockCustomizeMyDataProps) => {
    mockCustomizeMyDataProps = props;

    return (
      <div data-testid="customize-my-data">
        {props.initialPageData?.pageType ?? 'no-page'}
      </div>
    );
  }
);

const mockPersona = { id: 'persona-id', name: 'dataSteward' } as Persona;

const landingPage = {
  entityType: PageEntityType.Page,
  knowledgePanels: [],
  pageType: PageType.LandingPage,
  layout: [{ i: 'widget-1', x: 0, y: 0, w: 1, h: 1 }],
} as Page;

const existingDocument: Document = {
  id: 'doc-id',
  name: 'dataSteward-dataSteward',
  fullyQualifiedName: 'persona.dataSteward',
  entityType: EntityType.PAGE,
  data: { pages: [landingPage], navigation: null },
} as Document;

const renderEditor = (document: Document = existingDocument) => {
  const onDocumentSaved = jest.fn();
  const onActionsChange = jest.fn();

  render(
    <LandingPageEditor
      document={document}
      persona={mockPersona}
      onActionsChange={onActionsChange}
      onDocumentSaved={onDocumentSaved}
    />
  );

  const latestActions = (): CustomizeEditorActions =>
    onActionsChange.mock.calls[onActionsChange.mock.calls.length - 1][0];

  return { latestActions, onDocumentSaved };
};

describe('LandingPageEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCustomizeMyDataProps = undefined;
    useCustomizeStore.setState({
      currentPage: null,
      currentPageType: null,
      document: null,
    });
  });

  it('seeds the store and passes the saved landing page to CustomizeMyData', () => {
    const { latestActions } = renderEditor();

    expect(screen.getByTestId('customize-my-data')).toHaveTextContent(
      PageType.LandingPage
    );
    expect(useCustomizeStore.getState().currentPageType).toBe(
      PageType.LandingPage
    );
    expect(useCustomizeStore.getState().currentPage).toEqual(landingPage);
    expect(latestActions().canSave).toBe(false);
  });

  it('passes no initial page when the document has no landing page', () => {
    renderEditor({
      ...existingDocument,
      data: { pages: [], navigation: null },
    } as Document);

    expect(screen.getByTestId('customize-my-data')).toHaveTextContent(
      'no-page'
    );
  });

  it('patches the document when CustomizeMyData saves a layout', async () => {
    const newPage = { ...landingPage, layout: [] } as Page;
    const saved = {
      ...existingDocument,
      data: { pages: [newPage], navigation: null },
    } as Document;
    (updateDocument as jest.Mock).mockResolvedValue(saved);
    const { latestActions, onDocumentSaved } = renderEditor();

    await act(
      () => mockCustomizeMyDataProps?.onSaveLayout(newPage) ?? Promise.resolve()
    );

    expect(updateDocument).toHaveBeenCalledWith('doc-id', [
      { op: 'remove', path: '/data/pages/0/layout/0' },
    ]);
    expect(onDocumentSaved).toHaveBeenCalledWith(saved);
    expect(useCustomizeStore.getState().document).toEqual(saved);
    expect(showSuccessToast).toHaveBeenCalledWith(
      'server.page-layout-operation-success'
    );
    expect(latestActions()).toEqual(
      expect.objectContaining({ canSave: false, isSaving: false })
    );
  });

  it('removes the stored landing page when CustomizeMyData resets the layout', async () => {
    (updateDocument as jest.Mock).mockResolvedValue({
      ...existingDocument,
      data: { pages: [], navigation: null },
    });
    renderEditor();

    await act(
      () => mockCustomizeMyDataProps?.onSaveLayout() ?? Promise.resolve()
    );

    expect(updateDocument).toHaveBeenCalledWith('doc-id', [
      { op: 'remove', path: '/data/pages/0' },
    ]);
  });

  it('creates the document from the store page when saved from the footer', async () => {
    const draftDocument = { ...existingDocument, id: undefined } as Document;
    const saved = { ...existingDocument, id: 'new-id' } as Document;
    (createDocument as jest.Mock).mockResolvedValue(saved);
    const { latestActions, onDocumentSaved } = renderEditor(draftDocument);

    await act(async () => {
      await latestActions().onSave();
    });

    expect(createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { navigation: null, pages: [landingPage] },
      })
    );
    expect(updateDocument).not.toHaveBeenCalled();
    expect(onDocumentSaved).toHaveBeenCalledWith(saved);
  });

  it('shows an error and rethrows when saving fails', async () => {
    const error = new Error('save failed');
    (updateDocument as jest.Mock).mockRejectedValue(error);
    const { latestActions, onDocumentSaved } = renderEditor();

    await act(async () => {
      await expect(
        mockCustomizeMyDataProps?.onSaveLayout({
          ...landingPage,
          layout: [],
        } as Page)
      ).rejects.toBe(error);
    });

    expect(showErrorToast).toHaveBeenCalledWith(error);
    expect(onDocumentSaved).not.toHaveBeenCalled();
    expect(latestActions()).toEqual(
      expect.objectContaining({ canSave: true, isSaving: false })
    );
  });

  it('re-seeds the store from the document on reset', () => {
    const { latestActions } = renderEditor();

    act(() => {
      useCustomizeStore.getState().updateCurrentPage({
        pageType: PageType.LandingPage,
      } as Page);
    });
    act(() => {
      latestActions().onReset();
    });

    expect(useCustomizeStore.getState().currentPage).toEqual(landingPage);
    expect(latestActions().canSave).toBe(false);
  });

  it('passes the persona header colour saved in the document', () => {
    renderEditor({
      ...existingDocument,
      data: {
        ...existingDocument.data,
        personPreferences: [
          {
            personaId: mockPersona.id,
            personaName: mockPersona.name,
            landingPageSettings: { headerColor: '#123456' },
          },
        ],
      },
    } as Document);

    expect(mockCustomizeMyDataProps?.backgroundColor).toBe('#123456');
  });

  it('saves a new header colour into the persona preferences', async () => {
    const { onDocumentSaved } = renderEditor();
    (updateDocument as jest.Mock).mockImplementation(
      async (_id: string, patch: Array<{ op: string; path: string }>) => ({
        ...existingDocument,
        patch,
      })
    );

    await act(async () => {
      await mockCustomizeMyDataProps?.onBackgroundColorUpdate?.('#654321');
    });

    const patch = (updateDocument as jest.Mock).mock.calls[0][1];

    expect(JSON.stringify(patch)).toContain('#654321');
    expect(JSON.stringify(patch)).toContain(mockPersona.id);
    expect(onDocumentSaved).toHaveBeenCalled();
    expect(showSuccessToast).toHaveBeenCalled();
  });

  it('shows an error toast when saving the header colour fails', async () => {
    renderEditor();
    (updateDocument as jest.Mock).mockRejectedValue(new Error('boom'));

    await act(async () => {
      await mockCustomizeMyDataProps?.onBackgroundColorUpdate?.('#654321');
    });

    expect(showErrorToast).toHaveBeenCalled();
  });
});
