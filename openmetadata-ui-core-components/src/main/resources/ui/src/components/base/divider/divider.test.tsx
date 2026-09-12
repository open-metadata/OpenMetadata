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
import { Divider } from './divider';

const rule = () => screen.getByRole('separator');

describe('Divider', () => {
  it('draws a solid horizontal rule by default', () => {
    render(<Divider />);

    expect(rule()).toHaveClass('tw:h-px', 'tw:bg-border-secondary');
  });

  // A background cannot be dashed, so the dashed variant has to switch from a
  // filled box to a border.
  it('draws a dashed horizontal rule as a border', () => {
    render(<Divider dashed />);

    expect(rule()).toHaveClass('tw:h-0', 'tw:border-t', 'tw:border-dashed');
    expect(rule()).not.toHaveClass('tw:bg-border-secondary');
  });

  it('draws a dashed vertical rule on the left border', () => {
    render(<Divider dashed orientation="vertical" />);

    expect(rule()).toHaveClass('tw:w-0', 'tw:border-l', 'tw:border-dashed');
  });

  // `self-stretch` yields no height outside a flex/grid parent, and a consumer
  // aligning the divider itself overrides it — which silently collapsed the
  // rule to nothing. antd's vertical divider had an intrinsic height.
  it('gives a vertical rule an intrinsic height so it survives outside flex', () => {
    render(<Divider orientation="vertical" />);

    expect(rule()).toHaveClass('tw:self-stretch', 'tw:min-h-[1em]');
  });

  it('keeps the label layout and dashes both flanking rules', () => {
    const { container } = render(<Divider dashed label="OR" />);

    expect(screen.getByText('OR')).toBeInTheDocument();
    const flanks = container.querySelectorAll('.tw\\:flex-1');

    expect(flanks).toHaveLength(2);
    flanks.forEach((f) => expect(f).toHaveClass('tw:border-dashed'));
  });

  it('still honours labelAlign', () => {
    const { container } = render(<Divider label="OR" labelAlign="start" />);

    expect(container.querySelectorAll('.tw\\:flex-1')).toHaveLength(1);
  });
});
