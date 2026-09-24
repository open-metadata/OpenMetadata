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
import { render } from '@testing-library/react';
import {
  OccurrencesIcon,
  PendingChangesIcon,
  UniqueColumnsIcon,
} from './ColumnStatIcons';

const ICONS = [
  ['UniqueColumnsIcon', <UniqueColumnsIcon key="u" />, 'brand'],
  ['OccurrencesIcon', <OccurrencesIcon key="o" />, 'success'],
  ['PendingChangesIcon', <PendingChangesIcon key="p" />, 'warning'],
] as const;

describe('ColumnStatIcons', () => {
  it.each(ICONS)('%s paints every shape from the %s scale', (_, icon) => {
    const { container } = render(icon);
    const shapes = container.querySelectorAll('rect, path, circle, g');

    expect(shapes.length).toBeGreaterThan(0);

    shapes.forEach((shape) => {
      // A shape either carries a utility-* fill/stroke class or inherits one
      // from an ancestor <g>; what it must never do is bake a literal colour,
      // which would stay light-mode tinted under .dark-mode.
      const ownClass = shape.getAttribute('class') ?? '';
      const inherits = shape.closest('g[class*="utility-"]') !== null;

      expect(ownClass.includes('utility-') || inherits).toBe(true);
      expect(shape.getAttribute('fill')).toBeNull();
      expect(shape.getAttribute('stroke')).toBeNull();
    });
  });

  it.each(ICONS)('%s forwards sizing props to the root svg', (_, icon) => {
    const { container } = render(icon);
    const svg = container.querySelector('svg');

    expect(svg).toHaveAttribute('viewBox', '0 0 47 47');
  });
});
