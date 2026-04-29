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

import { getWidgetHint, getWidgetLabel } from './coreWidgetUtils';

describe('coreWidgetUtils', () => {
  it('prefers raw errors over help text and schema description', () => {
    expect(
      getWidgetHint({
        options: {
          help: 'Helpful text',
        },
        rawErrors: ['Validation error'],
        schema: {
          description: 'Schema description',
        },
      } as never)
    ).toBe('Validation error');

    expect(
      getWidgetHint({
        options: {
          help: 'Helpful text',
        },
        rawErrors: [],
        schema: {
          description: 'Schema description',
        },
      } as never)
    ).toBe('Helpful text');

    expect(
      getWidgetHint({
        options: {},
        rawErrors: [],
        schema: {
          description: 'Schema description',
        },
      } as never)
    ).toBe('Schema description');
  });

  it('hides labels only when hideLabel is true', () => {
    expect(
      getWidgetLabel({
        hideLabel: true,
        label: 'Name',
      } as never)
    ).toBeUndefined();

    expect(
      getWidgetLabel({
        hideLabel: false,
        label: 'Name',
      } as never)
    ).toBe('Name');
  });
});
