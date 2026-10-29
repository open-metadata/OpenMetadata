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
import { fireEvent, render, screen } from '@testing-library/react';
import { Edge, Node } from 'reactflow';
import {
  ExportTypes,
  LINEAGE_EXPORT_SELECTOR,
} from '../../../constants/Export.constants';
import { useLineageStore } from '../../../hooks/useLineageStore';
import { getExportViewportForNodes } from '../../../utils/EntityLineageLayoutUtils';
import LineageExportButton from './LineageExportButton';

const mockShowModal = jest.fn();

jest.mock(
  '../../Entity/EntityExportModalProvider/EntityExportModalProvider.component',
  () => ({
    useEntityExportModalProvider: () => ({ showModal: mockShowModal }),
  })
);

const MAP_NODES = [
  { id: 'service:a', position: { x: 0, y: 0 }, width: 400, height: 100 },
  { id: 'service:b', position: { x: 600, y: 0 }, width: 400, height: 100 },
] as Node[];
const MAP_EDGES = [
  { id: 'service:a->service:b', source: 'service:a', target: 'service:b' },
] as Edge[];

describe('LineageExportButton', () => {
  beforeEach(() => {
    mockShowModal.mockClear();
    useLineageStore.getState().reset();
    // The lineage map publishes the graph it draws to the store.
    useLineageStore.setState({ nodes: MAP_NODES, edges: MAP_EDGES });
  });

  it("exports the map's graph as a PNG without a surrounding <Lineage>", () => {
    // The AI-mode page header renders the button outside <Lineage>.
    render(<LineageExportButton />);

    fireEvent.click(screen.getByTestId('export-button'));

    const options = mockShowModal.mock.calls[0][0];

    expect(options).toEqual(
      expect.objectContaining({
        exportTypes: [ExportTypes.PNG],
        documentSelector: LINEAGE_EXPORT_SELECTOR,
      })
    );
    expect(options.getViewport(8000, 12000)).toEqual(
      getExportViewportForNodes(MAP_NODES, 8000, 12000)
    );
  });
});
