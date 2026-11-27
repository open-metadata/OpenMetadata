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
import { act, render, screen, within } from '@testing-library/react';
import { Edge, Viewport } from 'reactflow';
import { EntityType } from '../../../enums/entity.enum';
import { StatusType } from '../../../generated/entity/data/pipeline';
import {
  CanvasButton,
  ECanvasButtonType,
  getCanvasPipelinePreview,
} from '../../../utils/CanvasButtonUtils';
import { CanvasButtonPopover } from './CanvasButtonPopover.component';

jest.mock('../../common/PopOverCard/EntityPopOverCard', () => ({
  PopoverContent: ({
    entityFQN,
    entityType,
    extraInfo,
  }: {
    entityFQN: string;
    entityType: string;
    extraInfo?: React.ReactNode;
  }) => (
    <a href={`/${entityType}/${entityFQN}`}>
      {entityFQN}
      {extraInfo}
    </a>
  ),
}));

const viewport: Viewport = { x: 100, y: 100, zoom: 2 };
const button: CanvasButton = {
  x: 50,
  y: 50,
  width: 36,
  height: 36,
  edgeId: 'edge-1',
  type: ECanvasButtonType.Pipeline,
};
const edge: Edge = {
  id: 'edge-1',
  source: 'node-1',
  target: 'node-2',
  data: {
    edge: {
      pipeline: {
        id: 'pipeline-1',
        fullyQualifiedName: 'test.pipeline',
      },
    },
  },
};

const renderPreview = (edge: Edge, executionStatus?: StatusType) => {
  const preview = getCanvasPipelinePreview({
    button: { ...button, executionStatus },
    edge,
  });
  if (!preview) {
    throw new Error('Expected a preview for this annotator');
  }

  const { container } = render(
    <CanvasButtonPopover
      isHovered
      preview={preview}
      viewport={viewport}
      onCloseComplete={jest.fn()}
    />
  );
  act(() => jest.advanceTimersByTime(300));

  return container;
};

describe('CanvasButtonPopover', () => {
  beforeEach(() => jest.useFakeTimers());

  afterEach(() => jest.useRealTimers());

  it.each([StatusType.Successful, StatusType.Failed, StatusType.Pending])(
    'shows a pipeline link and %s status',
    (status) => {
      renderPreview(edge, status);

      expect(screen.getByRole('link')).toHaveAttribute(
        'href',
        '/pipeline/test.pipeline'
      );
      expect(screen.getByTestId('pipeline-status-badge')).toHaveTextContent(
        status
      );
    }
  );

  it('renders the stored procedure preview without an unavailable status', () => {
    const canvasAnchor = renderPreview({
      ...edge,
      data: {
        edge: {
          pipeline: {
            id: 'procedure-1',
            type: EntityType.STORED_PROCEDURE,
            fullyQualifiedName: 'test.db.schema.proc',
          },
        },
      },
    });

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/storedProcedure/test.db.schema.proc'
    );
    expect(screen.queryByTestId('pipeline-status-badge')).toBeNull();
    expect(within(canvasAnchor).queryByRole('button')).toBeNull();
  });

  it.each([
    { type: EntityType.PIPELINE, fullyQualifiedName: ' ' },
    { type: EntityType.TABLE, fullyQualifiedName: 'test.db.schema.table' },
  ])('skips a preview for invalid references such as %o', (pipeline) => {
    expect(
      getCanvasPipelinePreview({
        button,
        edge: { ...edge, data: { edge: { pipeline } } },
      })
    ).toBeUndefined();
  });
});
