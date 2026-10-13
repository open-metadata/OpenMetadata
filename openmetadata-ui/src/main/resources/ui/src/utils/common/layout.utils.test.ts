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
import { getLayoutGutter } from './layout.utils';

describe('getLayoutGutter', () => {
  it('pairs item padding with negative row margins using spacing tokens', () => {
    expect(getLayoutGutter(16, 8)).toEqual({
      '--layout-gutter': 'var(--om-space-16)',
      marginInline: 'calc(var(--om-space-16) / -2)',
      rowGap: 'var(--om-space-8)',
    });
  });

  it('keeps vertical-only gutters from resetting existing horizontal margins', () => {
    expect(getLayoutGutter(0, 16)).toEqual({
      '--layout-gutter': 'var(--om-space-0)',
      marginInline: undefined,
      rowGap: 'var(--om-space-16)',
    });
  });

  it('leaves row spacing to existing classes when no vertical gutter is supplied', () => {
    expect(getLayoutGutter(8).rowGap).toBeUndefined();
  });
});
