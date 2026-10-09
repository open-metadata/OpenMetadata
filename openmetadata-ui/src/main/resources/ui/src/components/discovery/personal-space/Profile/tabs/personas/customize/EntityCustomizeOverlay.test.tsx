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
import EntityCustomizeOverlay from './EntityCustomizeOverlay';

interface MockPageProps {
  isGlossary: boolean;
  onSaveLayout: (page?: Page) => Promise<void>;
}

let mockPageProps: MockPageProps | undefined;
// Page type in the shared store each time the details page renders.
const mockRenderedPageTypes: Array<string | null> = [];

jest.mock('../../../../../../../rest/DocStoreAPI', () => ({
  createDocument: jest.fn(),
  updateDocument: jest.fn(),
}));

jest.mock('../../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock(
  '../../../../../../../pages/CustomizeDetailsPage/CustomizeDetailsPage',
  () => ({
    CustomizeDetailsPage: (props: MockPageProps) => {
      mockPageProps = props;
      mockRenderedPageTypes.push(
        jest
          .requireActual(
            '../../../../../../../pages/CustomizablePage/CustomizeStore'
          )
          .useCustomizeStore.getState().currentPageType
      );

      return <div data-testid="customize-details-page" />;
    },
  })
);

jest.mock(
  '../../../../../../MyData/CustomizableComponents/CustomiseGlossaryTermDetailPage/CustomiseGlossaryTermDetailPage',
  () => (props: MockPageProps) => {
    mockPageProps = props;

    return (
      <div data-testid="customize-glossary-page">
        {String(props.isGlossary)}
      </div>
    );
  }
);

const mockPersona = { id: 'persona-id', name: 'dataSteward' } as Persona;

const baseDocument: Document = {
  name: 'dataSteward-dataSteward',
  fullyQualifiedName: 'persona.dataSteward',
  entityType: EntityType.PAGE,
  data: { pages: [], navigation: null },
} as Document;

const tablePage = {
  entityType: PageEntityType.Page,
  knowledgePanels: [],
  layout: [],
  pageType: PageType.Table,
  tabs: [],
} as Page;

const renderOverlay = (entityType: string, document = baseDocument) => {
  const onDocumentSaved = jest.fn();

  render(
    <EntityCustomizeOverlay
      document={document}
      entityType={entityType}
      persona={mockPersona}
      onDocumentSaved={onDocumentSaved}
    />
  );

  return onDocumentSaved;
};

describe('EntityCustomizeOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPageProps = undefined;
    mockRenderedPageTypes.length = 0;
    useCustomizeStore.setState({
      currentPage: null,
      currentPageType: null,
      document: null,
    });
  });

  it('waits for the shared store to switch page type before mounting the page', async () => {
    // Left over from customizing another entity in the same session.
    useCustomizeStore.setState({
      currentPage: tablePage,
      currentPageType: PageType.Table,
    });

    renderOverlay(PageType.APIEndpoint);

    expect(
      await screen.findByTestId('customize-details-page')
    ).toBeInTheDocument();
    expect(mockRenderedPageTypes).not.toContain(PageType.Table);
    expect(mockRenderedPageTypes).toContain(PageType.APIEndpoint);
  });

  it('renders the details page for non-glossary entities', async () => {
    renderOverlay(PageType.Table);

    expect(
      await screen.findByTestId('customize-details-page')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('customize-glossary-page')
    ).not.toBeInTheDocument();
    expect(useCustomizeStore.getState().currentPageType).toBe(PageType.Table);
  });

  it.each([
    [PageType.Glossary, 'true'],
    [PageType.GlossaryTerm, 'false'],
  ])('renders the glossary page for %s', async (entityType, isGlossaryText) => {
    renderOverlay(entityType);

    expect(
      await screen.findByTestId('customize-glossary-page')
    ).toHaveTextContent(isGlossaryText);
    expect(
      screen.queryByTestId('customize-details-page')
    ).not.toBeInTheDocument();
  });

  it('creates the document on first save and reports it', async () => {
    const saved = { ...baseDocument, id: 'new-id' } as Document;
    (createDocument as jest.Mock).mockResolvedValue(saved);
    const onDocumentSaved = renderOverlay(PageType.Table);

    await screen.findByTestId('customize-details-page');
    await act(
      () => mockPageProps?.onSaveLayout(tablePage) ?? Promise.resolve()
    );

    expect(createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pages: [tablePage] }),
        fullyQualifiedName: 'persona.dataSteward',
      })
    );
    expect(updateDocument).not.toHaveBeenCalled();
    expect(onDocumentSaved).toHaveBeenCalledWith(saved);
    expect(showSuccessToast).toHaveBeenCalledWith(
      'server.page-layout-operation-success'
    );
  });

  it('patches an existing document', async () => {
    const existing = { ...baseDocument, id: 'doc-id' } as Document;
    (updateDocument as jest.Mock).mockResolvedValue(existing);
    const onDocumentSaved = renderOverlay(PageType.Table, existing);

    await screen.findByTestId('customize-details-page');
    await act(
      () => mockPageProps?.onSaveLayout(tablePage) ?? Promise.resolve()
    );

    expect(updateDocument).toHaveBeenCalledWith('doc-id', [
      { op: 'add', path: '/data/pages/0', value: tablePage },
    ]);
    expect(createDocument).not.toHaveBeenCalled();
    expect(onDocumentSaved).toHaveBeenCalledWith(existing);
  });

  it('shows an error toast and rethrows when saving fails', async () => {
    const error = new Error('save failed');
    (createDocument as jest.Mock).mockRejectedValue(error);
    const onDocumentSaved = renderOverlay(PageType.Table);

    await screen.findByTestId('customize-details-page');

    await expect(mockPageProps?.onSaveLayout(tablePage)).rejects.toBe(error);
    expect(showErrorToast).toHaveBeenCalledWith(error);
    expect(onDocumentSaved).not.toHaveBeenCalled();
  });
});
