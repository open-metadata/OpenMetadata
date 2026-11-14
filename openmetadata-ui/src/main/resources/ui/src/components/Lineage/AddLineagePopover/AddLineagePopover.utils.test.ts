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
import { Node } from 'reactflow';
import { getCanvasColumnAssets } from './AddLineagePopover.utils';

const canvasNode = (node: Record<string, unknown>) =>
  ({ id: String(node.id), position: { x: 0, y: 0 }, data: { node } } as Node);

describe('getCanvasColumnAssets', () => {
  it('keeps column-carrying canvas nodes other than the edited one, once each', () => {
    const assets = getCanvasColumnAssets(
      [
        canvasNode({ id: 'self', entityType: 'table' }),
        canvasNode({ id: 't1', entityType: 'table' }),
        canvasNode({ id: 't1', entityType: 'table' }),
        canvasNode({ id: 'dm', entityType: 'dashboardDataModel' }),
        canvasNode({ id: 'p', entityType: 'pipeline' }),
        canvasNode({ id: 'tmp', entityType: 'table', isTempTable: true }),
        { id: 'load-more', position: { x: 0, y: 0 }, data: {} } as Node,
      ],
      'self'
    );

    expect(assets.map(({ id }) => id)).toEqual(['t1', 'dm']);
  });

  it('returns nothing when there is no canvas', () => {
    expect(getCanvasColumnAssets(undefined, 'self')).toEqual([]);
  });
});
