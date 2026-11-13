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
import { SortAscending } from '../icons';

describe('generated icons', () => {
  it('should not put a stroke on the root svg for shapes to inherit', () => {
    const offenders = Object.entries(
      Icons as Record<string, FC<SVGProps<SVGSVGElement>>>
    ).flatMap(([name, Icon]) => {
      const { container, unmount } = render(<Icon />);
      const hasRootStroke = container
        .querySelector('svg')
        ?.hasAttribute('stroke');
      unmount();

      return hasRootStroke ? [name] : [];
    });

    expect(offenders).toEqual([]);
  });

  it('should apply the color prop as the root color', () => {
    const { container } = render(<SortAscending color="red" />);

    expect(container.querySelector('svg')).toHaveAttribute('color', 'red');
  });
});
