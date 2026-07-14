/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { LayoutEngine } from '../OntologyExplorer.constants';
import { shouldUseComboGridLayout } from './graphConfig';

describe('shouldUseComboGridLayout', () => {
  it('uses the graph layout for Studio model graphs without glossary combos', () => {
    expect(
      shouldUseComboGridLayout(LayoutEngine.Dagre, {
        hasCombos: false,
        isHierarchyMode: false,
        isModelView: true,
      })
    ).toBe(false);
  });

  it('keeps the deterministic grid for model graphs with glossary combos', () => {
    expect(
      shouldUseComboGridLayout(LayoutEngine.Dagre, {
        hasCombos: true,
        isHierarchyMode: false,
        isModelView: true,
      })
    ).toBe(true);
  });

  it('does not replace a circular layout with the combo grid', () => {
    expect(
      shouldUseComboGridLayout(LayoutEngine.Circular, {
        hasCombos: true,
        isHierarchyMode: false,
        isModelView: true,
      })
    ).toBe(false);
  });
});
