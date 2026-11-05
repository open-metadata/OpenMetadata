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

  it('should size a drilled rule by the controls it has to fit', () => {
    // Holding the drawn proportions pushed the value past the panel's edge
    // once a level joined the row; sized columns let it wrap instead.
    expect(getQueryBuilderColumnRatios(2)).toBe(
      'repeat(auto-fit, minmax(150px, 1fr))'
    );
    expect(getQueryBuilderColumnRatios(3)).toBe(
      'repeat(auto-fit, minmax(150px, 1fr))'
    );
  });

  it('should keep a floor under every control so none is squeezed to nothing', () => {
    // Without it a drilled rule in a narrow panel renders `Operato`.
    expect(getQueryBuilderColumnRatios(3)).toContain('150px');
  });
});
