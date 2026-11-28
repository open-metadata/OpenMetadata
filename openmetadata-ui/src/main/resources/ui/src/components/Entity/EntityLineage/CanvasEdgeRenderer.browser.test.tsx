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
import { http, HttpResponse } from 'msw';
import ReactFlow, { Node } from 'reactflow';
import 'reactflow/dist/style.css';
import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { StatusType } from '../../../generated/entity/data/pipeline';
import { useLineageStore } from '../../../hooks/useLineageStore';
import { makePipeline } from '../../../test/browser/fixtures/dataAssets';
import { worker } from '../../../test/browser/msw';
import { renderWithApp } from '../../../test/browser/renderWithApp';
import { CanvasEdgeRenderer } from './CanvasEdgeRenderer.component';
import './entity-lineage.style.less';

const pipeline = makePipeline();
const nodes: Node[] = [
  {
    id: 'source',
    position: { x: 80, y: 150 },
    data: { label: 'Source table' },
    style: { width: 140, height: 40 },
  },
  {
    id: 'target',
    position: { x: 520, y: 150 },
    data: { label: 'Target table' },
    style: { width: 140, height: 40 },
  },
];
const edges = [
  {
    id: 'source-target',
    source: 'source',
    target: 'target',
    data: {
      edge: {
        pipelineEntityType: 'pipeline',
        pipeline: {
          ...pipeline,
          pipelineStatus: {
            executionStatus: StatusType.Successful,
            timestamp: 1,
          },
        },
      },
    },
  },
];

describe('CanvasEdgeRenderer', () => {
  it.each([
    ['entity lineage', undefined],
    ['lineage map', edges],
  ] as const)(
    'opens the %s preview with the pointer stationary on the canvas icon',
    async (_, suppliedEdges) => {
      const previousState = useLineageStore.getState();
      worker.use(
        http.get('/api/v1/pipelines/name/:fqn', ({ params }) => {
          expect(params.fqn).toBe(pipeline.fullyQualifiedName);

          return HttpResponse.json(pipeline);
        })
      );

      // The E2E helper uses webdriver to add DOM midpoint buttons, which bypass
      // the canvas hit test. This test needs the production canvas path.
      const webdriver = vi
        .spyOn(navigator, 'webdriver', 'get')
        .mockReturnValue(false);
      try {
        useLineageStore.setState({
          ...useLineageStore.getInitialState(),
          edges: suppliedEdges ? [] : edges,
        });
        await renderWithApp(
          <div style={{ width: 760, height: 400 }}>
            <ReactFlow nodes={nodes}>
              <CanvasEdgeRenderer
                dqHighlightedEdges={new Set()}
                edges={suppliedEdges}
                hoverEdge={null}
              />
            </ReactFlow>
          </div>,
          { url: '/canvas-lineage-test', path: '/canvas-lineage-test' }
        );

        const sourceNode = page.getByText('Source table');
        const targetNode = page.getByText('Target table');

        await expect.element(sourceNode).toBeVisible();
        await expect.element(targetNode).toBeVisible();

        const pane = page
          .getByTestId('rf__wrapper')
          .element()
          .querySelector('.react-flow__pane');
        if (!pane) {
          throw new Error('React Flow pane is missing');
        }
        const viewport = pane.getBoundingClientRect();
        const source = sourceNode.element().getBoundingClientRect();
        const target = targetNode.element().getBoundingClientRect();

        await page.elementLocator(pane).hover({
          position: {
            x: (source.right + target.left) / 2 - viewport.left,
            y: source.top + source.height / 2 - viewport.top,
          },
        });

        await expect
          .element(page.getByTestId('pipeline-status-badge'))
          .toHaveTextContent(StatusType.Successful);

        const link = page.getByRole('link', {
          name: pipeline.name,
          exact: true,
        });

        await expect
          .element(link)
          .toHaveAttribute('href', `/pipeline/${pipeline.fullyQualifiedName}`);

        await link.hover();

        await expect.element(link).toBeVisible();
      } finally {
        webdriver.mockRestore();
        useLineageStore.setState(previousState, true);
      }
    }
  );
});
