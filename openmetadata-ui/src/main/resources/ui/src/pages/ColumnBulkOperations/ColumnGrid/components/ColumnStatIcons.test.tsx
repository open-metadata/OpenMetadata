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
import { ComponentType, SVGProps } from 'react';
import {
  OccurrencesIcon,
  PendingChangesIcon,
  UniqueColumnsIcon,
} from './ColumnStatIcons';

const ICONS: ReadonlyArray<
  readonly [string, string, ComponentType<SVGProps<SVGSVGElement>>]
> = [
  ['UniqueColumnsIcon', 'brand', UniqueColumnsIcon],
  ['OccurrencesIcon', 'success', OccurrencesIcon],
  ['PendingChangesIcon', 'warning', PendingChangesIcon],
];

describe('ColumnStatIcons', () => {
  it.each(ICONS)(
    '%s paints every shape from the %s scale',
    (_name, scale, Icon) => {
      const { container } = render(<Icon />);
      const shapes = container.querySelectorAll('rect, path, circle, g');

      expect(shapes).not.toHaveLength(0);

      shapes.forEach((shape) => {
        const ownClass = shape.getAttribute('class') ?? '';
        const inherits =
          shape.closest(`g[class*="utility-${scale}-"]`) !== null;

        expect(ownClass.includes(`utility-${scale}-`) || inherits).toBe(true);
        expect(shape.getAttribute('fill')).toBeNull();
        expect(shape.getAttribute('stroke')).toBeNull();
      });
    }
  );

  it.each(ICONS)(
    '%s forwards sizing props to the root svg',
    (_name, _scale, Icon) => {
      const { container } = render(<Icon height={20} width={20} />);
      const svg = container.querySelector('svg');

      expect(svg).toHaveAttribute('width', '20');
      expect(svg).toHaveAttribute('height', '20');
      expect(svg).toHaveAttribute('viewBox', '0 0 47 47');
    }
  );
});
