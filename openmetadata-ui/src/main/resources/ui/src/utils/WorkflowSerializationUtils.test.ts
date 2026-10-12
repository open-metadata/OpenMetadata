/*
 *  Copyright 2025 Collate.
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
import { reconcileDataAssetFilters } from './WorkflowSerializationUtils';

const filter = (id: number, dataAsset: string) => ({
  id,
  dataAsset,
  filters: '',
});

describe('reconcileDataAssetFilters', () => {
  it('should keep filters whose asset type is still selected', () => {
    const filters = [filter(1, 'table'), filter(2, 'topic')];

    expect(reconcileDataAssetFilters(filters, ['table', 'topic'])).toEqual(
      filters
    );
  });

  // The regression this pins: a filter left behind after its asset type was
  // deselected can never match, and its builder keeps offering the removed
  // type's fields — no custom properties after switching ApiCollection to
  // Table, until the drawer was closed and reopened.
  it('should drop filters whose asset type was deselected', () => {
    const filters = [filter(1, 'apiCollection'), filter(2, 'table')];

    expect(reconcileDataAssetFilters(filters, ['table'])).toEqual([
      filter(2, 'table'),
    ]);
  });

  it('should drop every filter when no asset type is selected', () => {
    expect(reconcileDataAssetFilters([filter(1, 'table')], [])).toEqual([]);
  });

  it('should tolerate missing filters or selection', () => {
    expect(reconcileDataAssetFilters(undefined, ['table'])).toEqual([]);
    expect(reconcileDataAssetFilters([filter(1, 'table')], undefined)).toEqual(
      []
    );
  });
});
