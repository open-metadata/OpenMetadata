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
import { ReactElement, ReactNode } from 'react';
import { Layout } from 'react-grid-layout';
import { DetailPageWidgetKeys } from '../../../../../../../enums/CustomizeDetailPage.enum';
import { EntityType } from '../../../../../../../enums/entity.enum';
import { Document } from '../../../../../../../generated/entity/docStore/document';
import { Persona } from '../../../../../../../generated/entity/teams/persona';
import { Page, PageType } from '../../../../../../../generated/system/ui/page';
import { WidgetConfig } from '../../../../../../../pages/CustomizablePage/CustomizablePage.interface';
import { useCustomizeStore } from '../../../../../../../pages/CustomizablePage/CustomizeStore';
import {
  createDocument,
  updateDocument,
} from '../../../../../../../rest/DocStoreAPI';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../../utils/ToastUtils';
import { CustomizeEditorActions } from './customizeEditor.types';
import MarketplaceEditor from './MarketplaceEditor';

jest.mock('../../../../../../../rest/DocStoreAPI', () => ({
  createDocument: jest.fn(),
  updateDocument: jest.fn(),
}));

jest.mock('../../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock(
  '../../../../../../governance/marketplace/MarketplaceOverviewHeader/MarketplaceOverviewHeader',
  () =>
    ({ isCustomizeView }: { isCustomizeView?: boolean }) =>
      (
        <div data-testid="marketplace-overview-header">
          {`isCustomizeView:${String(isCustomizeView)}`}
        </div>
      )
);

jest.mock(
  '../../../../../../../utils/DataMarketplace/DataMarketplaceUtils',
  () => ({
    getDataMarketplaceWidgetsFromKey: (widget: WidgetConfig) => (
      <div data-testid={`widget-${widget.i}`}>{`${widget.x},${widget.w}`}</div>
    ),
  })
);

jest.mock('react-grid-layout', () => {
  const { Children, isValidElement, useEffect } = jest.requireActual('react');

  return {
    __esModule: true,
    default: jest.fn(),
    WidthProvider: () =>
      function MockGrid({
        children,
        onLayoutChange,
      }: {
        children: ReactNode;
        onLayoutChange: (layout: Layout[]) => void;
      }) {
        const layout: Layout[] = Children.toArray(children)
          .filter(isValidElement)
          .map(
            (child: ReactElement<{ 'data-grid': Layout }>) =>
              child.props['data-grid']
          );

        const reversed = layout.map((item, index) => ({
          ...item,
          y: layout.length - 1 - index,
        }));

        // Mirrors react-grid-layout, which reports the layout on mount.
        useEffect(() => {
          onLayoutChange(layout);
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

        return (
          <div data-testid="react-grid-layout">
            {children}
            <button
              data-testid="emit-same-layout"
              onClick={() => onLayoutChange(layout)}>
              Same layout
            </button>
            <button
              data-testid="emit-reordered-layout"
              onClick={() => onLayoutChange(reversed)}>
              Reorder layout
            </button>
          </div>
        );
      },
  };
});

const mockPersona = { id: 'persona-id', name: 'dataSteward' } as Persona;

const baseDocument: Document = {
  name: 'dataSteward-dataSteward',
  fullyQualifiedName: 'persona.dataSteward',
  entityType: EntityType.PAGE,
  data: { pages: [], navigation: null },
} as Document;

const savedMarketplacePage = {
  pageType: PageType.DataMarketplace,
  tabs: [
    {
      id: 'overview',
      name: 'overview',
      layout: [{ i: 'custom-widget', x: 2, y: 0, w: 3, h: 2 }],
    },
  ],
} as Page;

const renderEditor = (document: Document = baseDocument) => {
  const onDocumentSaved = jest.fn();
  const onActionsChange = jest.fn();

  render(
    <MarketplaceEditor
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

describe('MarketplaceEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCustomizeStore.setState({
      currentPage: null,
      currentPageType: null,
      document: null,
    });
  });

  it('renders the overview header in customize view and the default widgets', () => {
    const { latestActions } = renderEditor();

    expect(screen.getByTestId('marketplace-overview-header')).toHaveTextContent(
      'isCustomizeView:true'
    );
    expect(
      screen.getByTestId(
        `widget-${DetailPageWidgetKeys.MARKETPLACE_DATA_PRODUCTS}`
      )
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`widget-${DetailPageWidgetKeys.MARKETPLACE_DOMAINS}`)
    ).toBeInTheDocument();
    expect(useCustomizeStore.getState().currentPageType).toBe(
      PageType.DataMarketplace
    );
    expect(latestActions()).toEqual(
      expect.objectContaining({ canSave: false, isSaving: false })
    );
  });

  it('renders the saved layout stretched to the full grid width', () => {
    renderEditor({
      ...baseDocument,
      data: { pages: [savedMarketplacePage], navigation: null },
    } as Document);

    expect(screen.getByTestId('widget-custom-widget')).toHaveTextContent('0,8');
    expect(
      screen.queryByTestId(
        `widget-${DetailPageWidgetKeys.MARKETPLACE_DATA_PRODUCTS}`
      )
    ).not.toBeInTheDocument();
  });

  it('ignores the mount-time and unchanged layout reports', () => {
    const { latestActions } = renderEditor();

    expect(latestActions().canSave).toBe(false);

    fireEvent.click(screen.getByTestId('emit-same-layout'));

    expect(latestActions().canSave).toBe(false);
    expect(useCustomizeStore.getState().currentPage?.tabs).toBeUndefined();
  });

  it('marks the editor dirty when widgets are reordered', () => {
    const { latestActions } = renderEditor();

    fireEvent.click(screen.getByTestId('emit-reordered-layout'));

    expect(latestActions().canSave).toBe(true);
    expect(useCustomizeStore.getState().currentPage?.tabs?.[0]?.layout).toEqual(
      [
        expect.objectContaining({
          i: DetailPageWidgetKeys.MARKETPLACE_DATA_PRODUCTS,
          static: false,
          w: 8,
          x: 0,
          y: 1,
        }),
        expect.objectContaining({
          i: DetailPageWidgetKeys.MARKETPLACE_DOMAINS,
          y: 0,
        }),
      ]
    );
  });

  it('resets to the default layout and marks the editor dirty', () => {
    const { latestActions } = renderEditor({
      ...baseDocument,
      data: { pages: [savedMarketplacePage], navigation: null },
    } as Document);

    act(() => {
      latestActions().onReset();
    });

    expect(
      screen.queryByTestId('widget-custom-widget')
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId(
        `widget-${DetailPageWidgetKeys.MARKETPLACE_DATA_PRODUCTS}`
      )
    ).toBeInTheDocument();
    expect(latestActions().canSave).toBe(true);
  });

  it('creates the document with the current layout on save', async () => {
    const saved = { ...baseDocument, id: 'new-id' } as Document;
    (createDocument as jest.Mock).mockResolvedValue(saved);
    const { latestActions, onDocumentSaved } = renderEditor();

    act(() => {
      latestActions().onReset();
    });
    await act(async () => {
      await latestActions().onSave();
    });

    const payload = (createDocument as jest.Mock).mock.calls[0][0] as Document;
    const page = (payload.data.pages as Page[])[0];

    expect(page.pageType).toBe(PageType.DataMarketplace);
    expect(page.tabs?.[0]?.layout).toEqual([
      expect.objectContaining({
        i: DetailPageWidgetKeys.MARKETPLACE_DATA_PRODUCTS,
      }),
      expect.objectContaining({ i: DetailPageWidgetKeys.MARKETPLACE_DOMAINS }),
    ]);
    expect(onDocumentSaved).toHaveBeenCalledWith(saved);
    expect(useCustomizeStore.getState().document).toEqual(saved);
    expect(showSuccessToast).toHaveBeenCalledWith(
      'server.update-entity-success'
    );
    expect(latestActions()).toEqual(
      expect.objectContaining({ canSave: false, isSaving: false })
    );
  });

  it('patches an existing document on save', async () => {
    const existing = {
      ...baseDocument,
      id: 'doc-id',
      data: { pages: [savedMarketplacePage], navigation: null },
    } as Document;
    (updateDocument as jest.Mock).mockResolvedValue(existing);
    const { latestActions, onDocumentSaved } = renderEditor(existing);

    await act(async () => {
      await latestActions().onSave();
    });

    expect(updateDocument).toHaveBeenCalledWith('doc-id', expect.any(Array));
    expect(createDocument).not.toHaveBeenCalled();
    expect(onDocumentSaved).toHaveBeenCalledWith(existing);
  });

  it('shows an error toast and stays dirty when saving fails', async () => {
    const error = new Error('save failed');
    (createDocument as jest.Mock).mockRejectedValue(error);
    const { latestActions, onDocumentSaved } = renderEditor();

    act(() => {
      latestActions().onReset();
    });
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
