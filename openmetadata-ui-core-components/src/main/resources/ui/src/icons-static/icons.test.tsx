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
import { render } from '@testing-library/react';
import type { FC, SVGProps } from 'react';
import { describe, expect, it } from 'vitest';
import * as Icons from '../icons';

const SHAPES = 'path, circle, rect, ellipse, polygon, polyline, line';

const getShapesInheritingRootStroke = (svg: SVGSVGElement) =>
  Array.from(svg.querySelectorAll(SHAPES)).filter((shape) => {
    for (
      let node: Element | null = shape;
      node && node !== svg;
      node = node.parentElement
    ) {
      if (node.hasAttribute('stroke')) {
        return false;
      }
    }

    return true;
  });

describe('generated icons', () => {
  it('should not stroke shapes that the source SVG leaves unstroked', () => {
    const offenders = Object.entries(
      Icons as Record<string, FC<SVGProps<SVGSVGElement>>>
    ).flatMap(([name, Icon]) => {
      const { container, unmount } = render(<Icon />);
      const svg = container.querySelector('svg');
      const count =
        svg?.hasAttribute('stroke') === true
          ? getShapesInheritingRootStroke(svg).length
          : 0;
      unmount();

      return count ? [name] : [];
    });

    expect(offenders).toEqual([]);
  });
});
