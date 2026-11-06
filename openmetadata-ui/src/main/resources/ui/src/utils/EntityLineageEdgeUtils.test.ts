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
import { Edge } from 'reactflow';
import { ColumnLineage } from '../generated/type/entityLineage';
import { getColumnLineageData } from './EntityLineageEdgeUtils';

const COL_A = 'db.s.from.col_a';
const COL_B = 'db.s.from.col_b';
const COL_C = 'db.s.from.col_c';
const COL_X = 'db.t.to.col_x';
const COL_Y = 'db.t.to.col_y';

// React Flow puts the column FQNs used to identify a column edge on the
// TOP LEVEL of the edge object as `sourceHandle` / `targetHandle`. Column
// edges are constructed that way in createColumnEdgesAndMaps
// (EntityLineageEdgeUtils.ts). Building a minimal fake here mirrors that
// shape — the earlier bug was reading these handles from `edge.data`,
// where they don't exist, so the filter never matched and every column
// pair survived the "removal".
const buildColumnEdge = (sourceHandle: string, targetHandle: string): Edge =>
  ({
    id: `column-${sourceHandle}-${targetHandle}-edge-s-t`,
    source: 's',
    target: 't',
    sourceHandle,
    targetHandle,
    data: { isColumnLineage: true },
  } as unknown as Edge);

describe('getColumnLineageData', () => {
  it('drops the only fromColumn on a lineage entry and removes the entry', () => {
    const columns: ColumnLineage[] = [
      { fromColumns: [COL_A], toColumn: COL_X },
    ];
    const edge = buildColumnEdge(COL_A, COL_X);

    const result = getColumnLineageData(columns, edge);

    expect(result).toEqual([]);
  });

  it('keeps the entry when there are still other fromColumns after removal', () => {
    const columns: ColumnLineage[] = [
      { fromColumns: [COL_A, COL_B], toColumn: COL_X },
    ];
    const edge = buildColumnEdge(COL_A, COL_X);

    const result = getColumnLineageData(columns, edge);

    expect(result).toEqual([{ fromColumns: [COL_B], toColumn: COL_X }]);
  });

  it('leaves other toColumn entries untouched', () => {
    const columns: ColumnLineage[] = [
      { fromColumns: [COL_A], toColumn: COL_X },
      { fromColumns: [COL_C], toColumn: COL_Y },
    ];
    const edge = buildColumnEdge(COL_A, COL_X);

    const result = getColumnLineageData(columns, edge);

    expect(result).toEqual([{ fromColumns: [COL_C], toColumn: COL_Y }]);
  });

  it('reads sourceHandle/targetHandle from the top level of the edge, not edge.data', () => {
    // Regression: previously the function read `data.data?.sourceHandle`
    // (always undefined for React Flow edges), so the filter matched
    // nothing and the "removed" pair stayed in the returned array. The
    // fake edge here intentionally leaves `data` without `sourceHandle`
    // /`targetHandle` — the function must still drop the entry.
    const columns: ColumnLineage[] = [
      { fromColumns: [COL_A], toColumn: COL_X },
    ];
    const edge = buildColumnEdge(COL_A, COL_X);

    const result = getColumnLineageData(columns, edge);

    expect(result).toEqual([]);
  });
});
