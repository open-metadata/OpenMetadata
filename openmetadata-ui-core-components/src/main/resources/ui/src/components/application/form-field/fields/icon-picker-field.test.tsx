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

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IconPickerField } from './icon-picker-field';

describe('IconPickerField', () => {
  it('renders a stored palette color through its presentation token', () => {
    render(
      <IconPickerField
        backgroundColor="#ffb01a"
        items={[]}
        name="icon"
        value=""
      />
    );

    expect(screen.getByRole('button', { name: 'Select icon' })).toHaveStyle({
      backgroundColor: 'var(--color-entity-palette-amber)',
    });
  });
});
