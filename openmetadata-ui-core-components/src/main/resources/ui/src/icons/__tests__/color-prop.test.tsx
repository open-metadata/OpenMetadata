/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Gold } from '../Gold';
import { PlusCircle } from '../PlusCircle';
import { TreeView } from '../TreeView';

describe('icon color prop', () => {
  it('applies an explicit color prop to its paths (regular icon)', () => {
    // SVG2 attribute inheritance: a child presentation attribute
    // (stroke="currentColor" on each <path>) shadows the value that would
    // otherwise be inherited from the root. For the color prop to take
    // effect, the root must bind it AND no <path> may carry an overriding
    // stroke. Regression guard for the generator's per-element stroke
    // strip (removePerPathStroke in generate-icons.mjs).
    const { container } = render(<TreeView color="rgb(255, 0, 0)" />);

    expect(container.querySelector('svg')!.getAttribute('stroke')).toBe(
      'rgb(255, 0, 0)'
    );
    const overriding = Array.from(container.querySelectorAll('path')).filter(
      (p) => p.getAttribute('stroke') === 'currentColor'
    );
    expect(overriding).toHaveLength(0);
  });

  it('preserves strokeWidth on paths after stripping the per-element stroke', () => {
    // Regression guard for the removeUselessStrokeAndFill: false override
    // in sharedPlugins. Stripping per-path stroke orphans the stroke-width;
    // without the override, SVGO's removeUselessStrokeAndFill would delete
    // it on a later multipass, regressing stroke weight to the browser
    // default on 166/168 regular icons.
    const { container } = render(<TreeView color="rgb(255, 0, 0)" />);
    const paths = Array.from(container.querySelectorAll('path'));

    expect(paths).toHaveLength(2);
    for (const path of paths) {
      expect(path.getAttribute('stroke-width')).toBe('1.3');
    }
  });

  it('strips stroke from a <g> so it inherits the root (SVGO-hoisted stroke)', () => {
    // plus-circle.svg carries stroke on the <circle>/<path> children; SVGO's
    // preset-default hoists the common stroke onto the <g> parent. A
    // path-only strip would miss this case, so the fix's removeAttrs must
    // target every element. The <g> must lose its stroke (inherit root) and
    // keep its strokeWidth.
    const { container } = render(<PlusCircle color="rgb(255, 0, 0)" />);

    expect(container.querySelector('svg')!.getAttribute('stroke')).toBe(
      'rgb(255, 0, 0)'
    );
    expect(container.querySelector('g')!.getAttribute('stroke')).toBeNull();
    expect(container.querySelector('g')!.getAttribute('stroke-width')).toBe(
      '1.8'
    );
  });

  it('preserves brand strokes on custom badge icons (regression guard)', () => {
    // The fix is scoped to the regular pipeline only (svgoRegularConfig);
    // svgoCustomConfig never lists removePerPathStroke. The four
    // hand-authored badge icons must keep their brand strokes.
    const { container } = render(<Gold />);

    expect(container.querySelector('path')!.getAttribute('stroke')).toBe(
      '#C67E17'
    );
  });
});
