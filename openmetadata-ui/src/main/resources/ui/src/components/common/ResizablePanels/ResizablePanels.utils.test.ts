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
import { getEnforcedMinWidthStyle } from './ResizablePanels.utils';

const panel = { children: null, minWidth: 400 };

describe('getEnforcedMinWidthStyle', () => {
  it('returns the panel minWidth as a CSS min width when enforceMinWidth is set', () => {
    expect(
      getEnforcedMinWidthStyle({ ...panel, enforceMinWidth: true }, false)
    ).toEqual({ minWidth: 400 });
  });

  it('returns nothing when enforceMinWidth is not set', () => {
    expect(getEnforcedMinWidthStyle(panel, false)).toBeUndefined();
  });

  it('returns nothing while the panel is collapsed, so it can shrink to zero', () => {
    expect(
      getEnforcedMinWidthStyle({ ...panel, enforceMinWidth: true }, true)
    ).toBeUndefined();
  });
});
