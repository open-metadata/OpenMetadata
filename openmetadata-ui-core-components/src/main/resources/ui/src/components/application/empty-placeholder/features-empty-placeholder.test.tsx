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
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FeaturesEmptyPlaceholder } from './features-empty-placeholder';

describe('FeaturesEmptyPlaceholder', () => {
  // jsdom cannot resolve a CSS var() cascade (no stylesheet/computed-style
  // engine), so the dark flip itself can only be verified in Storybook. What we
  // CAN — and must — guard is the wiring that regressed: the background has to
  // read the source --gradient-* custom property (which inherits and is
  // re-pointed under .dark-mode), NOT the --tw-gradient-* mirror
  // (@property inherits:false) that cannot flip for descendants. Reverting to
  // the mirror silently restored the unreadable light gradient in dark.
  it('paints the background from the inheriting gradient token', () => {
    render(<FeaturesEmptyPlaceholder title="Get started" />);

    expect(
      screen.getByTestId('empty-placeholder').getAttribute('style')
    ).toContain('var(--gradient-empty-placeholder-features)');
  });

  it('lets a caller-supplied background win over the default', () => {
    render(
      <FeaturesEmptyPlaceholder
        style={{ background: 'red' }}
        title="Get started"
      />
    );

    const style = screen.getByTestId('empty-placeholder').getAttribute('style');

    expect(style).toContain('background: red');
    expect(style).not.toContain('var(--gradient-empty-placeholder-features)');
  });
});
