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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Edge, Node } from 'reactflow';
import {
  ExportTypes,
  LINEAGE_EXPORT_SELECTOR,
} from '../../../constants/Export.constants';
import { EntityType } from '../../../enums/entity.enum';
import { useLineageStore } from '../../../hooks/useLineageStore';
import { drawEdgesForExport } from '../../../utils/CanvasUtils';
import { getExportViewportForNodes } from '../../../utils/EntityLineageLayoutUtils';
import { Lineage } from './Lineage';
import { useLineageHandlers } from './LineageHandlersContext';

const mockShowModal = jest.fn();
const EXPORT_VIEWPORT = { x: 4, y: 8, zoom: 0.5 };

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock(
  '../../Entity/EntityExportModalProvider/EntityExportModalProvider.component',
  () => ({
    useEntityExportModalProvider: () => ({ showModal: mockShowModal }),
  })
);

jest.mock('../../../utils/CanvasUtils', () => ({
  ...jest.requireActual('../../../utils/CanvasUtils'),
  drawEdgesForExport: jest.fn(),
}));

const MAP_NODES = [
  { id: 'service:a', position: { x: 0, y: 0 }, data: {} },
  { id: 'service:b', position: { x: 400, y: 0 }, data: {} },
] as Node[];
const MAP_EDGES = [
  {
    id: 'scene-edge:service:a->service:b:LAYER',
    source: 'service:a',
    target: 'service:b',
  },
] as Edge[];

const ExportTrigger = () => {
  const { onExportClick } = useLineageHandlers();

  return (
    <button
      data-testid="trigger-export"
      onClick={() => onExportClick([ExportTypes.PNG])}>
      Export
    </button>
  );
};

jest.mock('../../../rest/lineageAPI', () => ({
  getDataQualityLineage: jest.fn(),
  getLineageDataByFQN: jest.fn(),
  getPlatformLineage: jest.fn(),
  updateLineageEdge: jest.fn(),
  exportLineageAsync: jest.fn(),
}));

jest.mock('../../Entity/EntityInfoDrawer/EdgeInfoDrawer.component', () => ({
  __esModule: true,
  default: () => <div data-testid="edge-info-drawer" />,
}));

jest.mock(
  '../../Entity/EntityLineage/AppPipelineModel/AddPipeLineModal',
  () => ({
    __esModule: true,
    default: () => <div data-testid="add-pipeline-modal" />,
  })
);

jest.mock('@openmetadata/ui-core-components', () => {
  type ChildrenProps = { children?: ReactNode };

  const DialogComponent = ({
    children,
    'data-testid': dataTestId,
  }: ChildrenProps & { 'data-testid'?: string }) => (
    <div data-testid={dataTestId} role="dialog">
      {children}
    </div>
  );
  DialogComponent.Header = ({ title }: { title?: ReactNode }) => (
    <div>{title}</div>
  );
  DialogComponent.Content = ({ children }: ChildrenProps) => (
    <div>{children}</div>
  );
  DialogComponent.Footer = ({ children }: ChildrenProps) => (
    <div>{children}</div>
  );

  return {
    Button: ({
      children,
      'data-testid': dataTestId,
    }: ChildrenProps & { 'data-testid'?: string }) => (
      <button data-testid={dataTestId} type="button">
        {children}
      </button>
    ),
    Dialog: DialogComponent,
    Modal: ({ children }: ChildrenProps) => <>{children}</>,
    ModalOverlay: ({
      isOpen,
      children,
    }: ChildrenProps & { isOpen?: boolean }) =>
      isOpen ? <>{children}</> : null,
    SlideoutMenu: ({ children }: ChildrenProps) => <>{children}</>,
  };
});

describe('Lineage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLineageStore.getState().reset();
  });

  it('sets entity context on mount and renders overlays', () => {
    render(
      <MemoryRouter>
        <Lineage entityFqn="svc.db.s.t" isPlatformLineage={false} />
      </MemoryRouter>
    );

    expect(useLineageStore.getState().entityFqn).toBe('svc.db.s.t');
  });

  it.each([
    [false, true],
    [true, false],
  ])(
    'with ?fullscreen=true, platform=%s goes full screen: %s',
    (isPlatformLineage, expected) => {
      const { container } = render(
        <MemoryRouter initialEntries={['/lineage?fullscreen=true']}>
          <Lineage entityFqn="x" isPlatformLineage={isPlatformLineage} />
        </MemoryRouter>
      );

      expect(Boolean(container.querySelector('.full-screen-lineage'))).toBe(
        expected
      );
    }
  );

  it('mirrors entityFqn to the store on mount with default props', () => {
    render(
      <MemoryRouter>
        <Lineage entityFqn="x" isPlatformLineage={false} />
      </MemoryRouter>
    );

    expect(useLineageStore.getState().entityFqn).toBe('x');
  });

  it('mirrors local nodes/edges/entityLineage to the store after mount', async () => {
    render(
      <MemoryRouter>
        <Lineage
          entityFqn="svc.db.s.t"
          entityType={EntityType.TABLE}
          isPlatformLineage={false}
        />
      </MemoryRouter>
    );

    // After the mount + fetch cycle settles, store fields should carry the
    // mirrored entity-context values.
    await waitFor(() => {
      const s = useLineageStore.getState();

      expect(s.entityFqn).toBe('svc.db.s.t');
      expect(s.entityType).toBe(EntityType.TABLE);
    });
  });

  describe('on the Lineage page, where the lineage map draws the graph', () => {
    beforeEach(() => {
      // The map publishes what it draws; its effects run before this
      // parent's, so the graph is already in the store when Lineage mounts.
      useLineageStore.setState({ nodes: MAP_NODES, edges: MAP_EDGES });
    });

    it("keeps the map's graph in the store", () => {
      render(
        <MemoryRouter>
          <Lineage isPlatformLineage entityFqn="" />
        </MemoryRouter>
      );

      expect(useLineageStore.getState().nodes).toEqual(MAP_NODES);
      expect(useLineageStore.getState().edges).toEqual(MAP_EDGES);
    });

    it("exports the map's graph as a PNG with its edges and off-screen nodes", async () => {
      render(
        <MemoryRouter>
          <Lineage isPlatformLineage entityFqn="">
            <ExportTrigger />
          </Lineage>
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTestId('trigger-export'));

      const options = mockShowModal.mock.calls[0][0];

      expect(options).toEqual(
        expect.objectContaining({
          exportTypes: [ExportTypes.PNG],
          documentSelector: LINEAGE_EXPORT_SELECTOR,
        })
      );
      // The capture asks for the frame once every node is mounted, with the
      // size it renders at.
      expect(options.getViewport(8000, 12000)).toEqual(
        getExportViewportForNodes(MAP_NODES, 8000, 12000)
      );

      options.renderEdgesOverlay(800, 600, 20, 2, EXPORT_VIEWPORT);

      expect(drawEdgesForExport).toHaveBeenCalledWith(
        MAP_EDGES,
        new Map(MAP_NODES.map((node) => [node.id, node])),
        EXPORT_VIEWPORT,
        800,
        600,
        20,
        2,
        expect.anything()
      );

      // beforeCapture waits two frames for the mounted nodes to paint.
      jest
        .spyOn(window, 'requestAnimationFrame')
        .mockImplementation((callback: FrameRequestCallback) => {
          callback(0);

          return 0;
        });
      await options.beforeCapture();

      expect(useLineageStore.getState().renderAllNodes).toBe(true);

      options.afterCapture();

      expect(useLineageStore.getState().renderAllNodes).toBe(false);
    });
  });
});
