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
import contextCenterClassBase from './ContextCenterClassBase';

describe('ContextCenterClassBase.getPageContainerClassName', () => {
  it('paints the canvas on classic pages', () => {
    expect(contextCenterClassBase.getPageContainerClassName()).toBe(
      'tw:bg-canvas'
    );
    expect(contextCenterClassBase.getPageContainerClassName(false)).toBe(
      'tw:bg-canvas'
    );
  });

  // In AI mode the page sits in the shell's content card; painting the canvas
  // there turned the light-mode page off-white instead of the card's white.
  it('leaves the page transparent in AI mode', () => {
    expect(contextCenterClassBase.getPageContainerClassName(true)).toBe('');
  });
});
