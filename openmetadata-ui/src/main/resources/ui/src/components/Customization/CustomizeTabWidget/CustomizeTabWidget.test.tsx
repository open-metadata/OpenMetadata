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
import { ReactNode } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { EntityTabs } from '../../../enums/entity.enum';
import { PageType } from '../../../generated/system/ui/page';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useCustomizeStore } from '../../../pages/CustomizablePage/CustomizeStore';
import { CustomizeTabWidget } from './CustomizeTabWidget';

const renderWithDnd = (ui: ReactNode) =>
  render(<DndProvider backend={HTML5Backend}>{ui}</DndProvider>);

jest.mock('../../../hooks/platform/useLeftPanelCrossDrop', () => ({
  useLeftPanelCrossDrop: jest.fn(() => ({
    panelRef: { current: null },
    dropTarget: null,
    takeDrop: jest.fn(() => null),
    handleTabDrag: jest.fn(),
    handleTabDragStop: jest.fn(),
    handlePanelDrag: jest.fn(),
    handlePanelDragStop: jest.fn(),
  })),
}));

jest.mock('../../../hooks/useGridLayoutDirection', () => ({
  useGridLayoutDirection: jest.fn(),
}));

jest.mock(
  '../../MyData/CustomizableComponents/EmptyWidgetPlaceholder/EmptyWidgetPlaceholder',
  () => ({
    __esModule: true,
    default: () => <div data-testid="mock-empty-widget-placeholder" />,
  })
);

jest.mock('../GenericTab/LeftPanelContainer', () => ({
  __esModule: true,
  LeftPanelContainer: () => <div data-testid="mock-left-panel" />,
}));

jest.mock('../GenericWidget/GenericWidget', () => ({
  __esModule: true,
  GenericWidget: () => <div data-testid="mock-generic-widget" />,
}));

jest.mock(
  '../../MyData/CustomizableComponents/AddDetailsPageWidgetModal/AddDetailsPageWidgetModal',
  () => ({
    __esModule: true,
    default: () => <div data-testid="mock-add-widget-modal" />,
  })
);

jest.mock('react-grid-layout', () => ({
  __esModule: true,
  default: jest.fn(),
  WidthProvider: () =>
    function MockGrid({ children }: { children: ReactNode }) {
      return <div data-testid="react-grid-layout">{children}</div>;
    },
}));

describe('CustomizeTabWidget', () => {
  const KG_TAB_ID = `tab-${EntityTabs.KNOWLEDGE_GRAPH}`;
  const SCHEMA_TAB_ID = `tab-${EntityTabs.SCHEMA}`;

  beforeEach(() => {
    useApplicationStore.setState({ rdfEnabled: false });
    useCustomizeStore.setState({
      currentPage: null,
      currentPageType: PageType.Table,
      document: null,
    });
  });

  it('renders the default schema tab for the table page', () => {
    renderWithDnd(<CustomizeTabWidget />);

    expect(screen.getByTestId(SCHEMA_TAB_ID)).toBeInTheDocument();
  });

  it('omits the Knowledge Graph tab while rdfEnabled is still unresolved', () => {
    renderWithDnd(<CustomizeTabWidget />);

    expect(screen.queryByTestId(KG_TAB_ID)).not.toBeInTheDocument();
  });

  it('recomputes the default tabs and shows the Knowledge Graph tab once rdfEnabled resolves to true', () => {
    renderWithDnd(<CustomizeTabWidget />);

    expect(screen.queryByTestId(KG_TAB_ID)).not.toBeInTheDocument();

    act(() => {
      useApplicationStore.setState({ rdfEnabled: true });
    });

    expect(screen.getByTestId(KG_TAB_ID)).toBeInTheDocument();
    expect(screen.getByTestId(SCHEMA_TAB_ID)).toBeInTheDocument();
  });

  it('keeps the Knowledge Graph tab hidden when rdfEnabled stays false across re-renders', () => {
    const { rerender } = renderWithDnd(<CustomizeTabWidget />);

    expect(screen.queryByTestId(KG_TAB_ID)).not.toBeInTheDocument();

    rerender(
      <DndProvider backend={HTML5Backend}>
        <CustomizeTabWidget />
      </DndProvider>
    );

    expect(screen.queryByTestId(KG_TAB_ID)).not.toBeInTheDocument();
  });

  it('surfaces the Knowledge Graph tab as a re-addable hidden tab when a saved page lacks it and rdfEnabled resolves to true', () => {
    useCustomizeStore.setState({
      currentPage: {
        pageType: PageType.Table,
        tabs: [
          {
            id: EntityTabs.SCHEMA,
            name: EntityTabs.SCHEMA,
            layout: [],
            editable: true,
          },
        ],
      } as never,
    });

    renderWithDnd(<CustomizeTabWidget />);

    expect(screen.queryByTestId(KG_TAB_ID)).not.toBeInTheDocument();
    expect(screen.getByTestId(SCHEMA_TAB_ID)).toBeInTheDocument();

    act(() => {
      useApplicationStore.setState({ rdfEnabled: true });
    });

    expect(screen.getByTestId(KG_TAB_ID)).toBeInTheDocument();
  });
});
