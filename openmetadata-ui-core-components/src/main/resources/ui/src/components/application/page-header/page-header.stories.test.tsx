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
import { CompactDensity } from '../../../stories/PageHeader.stories';

describe('PageHeader.stories', () => {
  it('updates the explanatory copy when the density control changes', () => {
    const story = CompactDensity;
    const { rerender } = render(
      story.render({ ...story.args, density: 'compact' })
    );

    expect(
      screen.getByRole('heading', { name: 'Compact density — 12px' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Reduced vertical padding for denser application shells')
    ).toBeInTheDocument();

    rerender(story.render({ ...story.args, density: 'comfortable' }));

    expect(
      screen.getByRole('heading', { name: 'Comfortable density — 16px' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Default vertical padding for standard page layouts')
    ).toBeInTheDocument();
  });
});
