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
import { describe, expect, it } from 'vitest';
import { AiAgent } from './AiAgent';
import { Automator02 } from './Automator02';
import { Cube01 } from './Cube01';
import { FileLock02 } from './FileLock02';
import { Plus } from './Plus';

describe('Generated icons — strokeWidth prop', () => {
  describe('consumer strokeWidth override', () => {
    it('applies consumer strokeWidth to the <svg> root (FileLock02)', () => {
      const { container } = render(<FileLock02 strokeWidth={2} />);
      const svg = container.querySelector('svg');

      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('stroke-width', '2');
    });

    it('applies consumer strokeWidth to the <svg> root (Cube01)', () => {
      const { container } = render(<Cube01 strokeWidth={1.5} />);
      const svg = container.querySelector('svg');

      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('stroke-width', '1.5');
    });

    it('paths have no per-path strokeWidth — they inherit from the root', () => {
      const { container } = render(<FileLock02 strokeWidth={2} />);
      const path = container.querySelector('path');

      expect(path).not.toHaveAttribute('stroke-width');
    });

    it('all paths in a multi-path icon inherit from the root', () => {
      const { container } = render(<Plus strokeWidth={3} />);
      const paths = container.querySelectorAll('path');

      expect(paths.length).toBeGreaterThan(0);
      for (const path of paths) {
        expect(path).not.toHaveAttribute('stroke-width');
      }
      expect(container.querySelector('svg')).toHaveAttribute(
        'stroke-width',
        '3'
      );
    });
  });

  describe('default stroke weight (no strokeWidth passed)', () => {
    it('preserves the designed 1.3 weight on the root (FileLock02)', () => {
      const { container } = render(<FileLock02 />);
      const svg = container.querySelector('svg');

      expect(svg).toHaveAttribute('stroke-width', '1.3');
    });

    it('preserves the designed 1.3 weight on the root (Cube01)', () => {
      const { container } = render(<Cube01 />);
      const svg = container.querySelector('svg');

      expect(svg).toHaveAttribute('stroke-width', '1.3');
    });

    it('preserves a non-1.3 designed weight (Plus = 1.8)', () => {
      const { container } = render(<Plus />);
      const svg = container.querySelector('svg');

      expect(svg).toHaveAttribute('stroke-width', '1.8');
    });
  });

  describe('mixed-weight icons keep per-path strokeWidth', () => {
    it('Automator02 retains distinct per-path stroke widths', () => {
      const { container } = render(<Automator02 />);
      const svg = container.querySelector('svg');
      const paths = container.querySelectorAll('path');

      // The root does NOT carry a hoisted default because the icon
      // intentionally mixes 1.2 and 1.3 across its paths.
      expect(svg).not.toHaveAttribute('stroke-width');

      // Each path keeps its own designed weight.
      const widths = [...paths].map((p) => p.getAttribute('stroke-width'));
      expect(widths).toContain('1.2');
      expect(widths).toContain('1.3');
    });

    it('consumer strokeWidth lands on the root but paths keep their own weight', () => {
      const { container } = render(<Automator02 strokeWidth={2} />);
      const svg = container.querySelector('svg');
      const paths = container.querySelectorAll('path');

      // The consumer prop still reaches the root via {...props}.
      expect(svg).toHaveAttribute('stroke-width', '2');

      // But the paths' own presentation attributes override the root value.
      const widths = [...paths].map((p) => p.getAttribute('stroke-width'));
      expect(widths).toContain('1.2');
      expect(widths).toContain('1.3');
      expect(widths).not.toContain('2');
    });
  });

  describe('fill-only icons are unaffected', () => {
    it('AiAgent has no designed stroke-width on the root by default', () => {
      const { container } = render(<AiAgent />);
      const svg = container.querySelector('svg');

      expect(svg).not.toHaveAttribute('stroke-width');
      for (const path of container.querySelectorAll('path')) {
        expect(path).not.toHaveAttribute('stroke-width');
      }
    });

    it('AiAgent paths stay fill-only even with a consumer strokeWidth', () => {
      const { container } = render(<AiAgent strokeWidth={2} />);
      const svg = container.querySelector('svg');

      // The consumer prop lands on the root, but the fill-only paths have no
      // stroke at all, so stroke-width is irrelevant to them.
      expect(svg).toHaveAttribute('stroke-width', '2');
      for (const path of container.querySelectorAll('path')) {
        expect(path).not.toHaveAttribute('stroke-width');
      }
    });
  });

  describe('createIconWithStroke pattern', () => {
    it('a wrapper passing strokeWidth via props overrides the default', () => {
      const Wrapper = (props: { size?: number }) => (
        <FileLock02 {...props} strokeWidth={1.2} />
      );
      const { container } = render(<Wrapper />);
      const svg = container.querySelector('svg');

      expect(svg).toHaveAttribute('stroke-width', '1.2');
    });
  });
});
