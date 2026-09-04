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
import React from 'react';
import { preprocessMarkdownText } from '../markdownComponents';
import MarkdownCaveat from './MarkdownCaveat';

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => <div>{children}</div>,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('MarkdownCaveat', () => {
  it('renders the message with no heading to read past', () => {
    render(
      <MarkdownCaveat caveatType="substitution">
        Queried &quot;banking&quot;, not &quot;private banking&quot;.
      </MarkdownCaveat>
    );

    expect(
      screen.getByTestId('markdown-caveat-substitution')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Queried "banking", not "private banking".')
    ).toBeInTheDocument();
    // The visible text is the message alone: no heading occupying its own line.
    expect(screen.getByText('label.warning')).toHaveClass('tw:sr-only');
  });

  it('keeps the severity available to assistive technology', () => {
    render(
      <MarkdownCaveat caveatType="proxyMetric">
        Fee revenue only.
      </MarkdownCaveat>
    );

    expect(screen.getByRole('note')).toBeInTheDocument();
    expect(screen.getByText('label.warning')).toHaveClass('tw:sr-only');
  });

  it('looks the same for every divergence kind', () => {
    const { container: a } = render(
      <MarkdownCaveat caveatType="substitution">x</MarkdownCaveat>
    );
    const { container: b } = render(
      <MarkdownCaveat caveatType="assumption">x</MarkdownCaveat>
    );

    expect(a.firstElementChild?.className).toBe(b.firstElementChild?.className);
  });

  it('marks a platform limitation as a note rather than a warning', () => {
    render(
      <MarkdownCaveat caveatType="dataLimitation">
        Profiling is missing; run the Profiler workflow.
      </MarkdownCaveat>
    );

    // Same block, different signal: the reader can act on this, they are not being warned.
    expect(
      screen.getByTestId('markdown-caveat-dataLimitation')
    ).toBeInTheDocument();
    expect(screen.getByText('label.note')).toHaveClass('tw:sr-only');
    expect(screen.queryByText('label.warning')).not.toBeInTheDocument();
  });
});

describe('preprocessMarkdownText caveat rewriting', () => {
  it('rewrites a caveat marker into a typed fence', () => {
    const out = preprocessMarkdownText(
      ':::caveat[proxyMetric]\nFee revenue only.\n:::'
    );

    expect(out).toBe('```caveat-proxyMetric\nFee revenue only.\n```');
  });

  it('leaves the caveat where the response put it', () => {
    const out = preprocessMarkdownText(
      'Revenue was 4M.\n\n:::caveat[assumption]\nTook the fiscal-year reading.\n:::\n\n**Next steps:**'
    );

    expect(out.indexOf('caveat-assumption')).toBeGreaterThan(
      out.indexOf('Revenue was 4M.')
    );
    expect(out.indexOf('caveat-assumption')).toBeLessThan(
      out.indexOf('**Next steps:**')
    );
  });

  it('leaves text carrying no marker untouched', () => {
    expect(preprocessMarkdownText('Revenue was 4M.')).toBe('Revenue was 4M.');
  });
});
