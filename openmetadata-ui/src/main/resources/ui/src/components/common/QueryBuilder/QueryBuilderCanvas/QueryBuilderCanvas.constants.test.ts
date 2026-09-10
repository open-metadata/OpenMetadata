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
import {
  getQueryBuilderColumnRatios,
  QUERY_BUILDER_COLUMN_RATIOS,
} from './QueryBuilderCanvas.constants';

describe('getQueryBuilderColumnRatios', () => {
  it('should leave an ordinary rule on the ratios Figma specifies', () => {
    expect(getQueryBuilderColumnRatios(1)).toBe(QUERY_BUILDER_COLUMN_RATIOS);
  });

  it('should widen the Field column once a rule drills', () => {
    // Splitting the one column three ways truncates every label, so the
    // column grows per level and the value column gives up the room.
    expect(getQueryBuilderColumnRatios(2)).toContain('120fr');
    expect(getQueryBuilderColumnRatios(3)).toContain('160fr');
  });

  it('should floor the operator column so it cannot be squeezed to nothing', () => {
    // Without the floor a drilled rule in a narrow panel renders `Operato`.
    expect(getQueryBuilderColumnRatios(3)).toContain('minmax(120px, 41fr)');
  });
});
