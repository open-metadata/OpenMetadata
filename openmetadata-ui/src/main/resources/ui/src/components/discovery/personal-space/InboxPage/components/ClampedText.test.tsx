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
import { ReactNode } from 'react';

let mockIsClamped = false;

jest.mock('../../../../../hooks/useIsTextClamped', () => ({
  useIsTextClamped: () => ({
    ref: { current: null },
    isClamped: mockIsClamped,
  }),
}));

// The tooltip itself is core's concern; here only what it is handed matters.
jest.mock('@openmetadata/ui-core-components', () => ({
  Tooltip: ({
    children,
    title,
    isDisabled,
  }: {
    children: ReactNode;
    title: string;
    isDisabled?: boolean;
  }) => (
    <div
      data-disabled={String(Boolean(isDisabled))}
      data-testid="tooltip"
      title={title}>
      {children}
    </div>
  ),
}));

import ClampedText from './ClampedText';

describe('ClampedText', () => {
  it('offers the full text when the clamp cuts it off', () => {
    mockIsClamped = true;
    render(
      <ClampedText text="A long task title">
        <a href="/asset">A long task title</a>
      </ClampedText>
    );

    const tooltip = screen.getByTestId('tooltip');

    expect(tooltip).toHaveAttribute('title', 'A long task title');
    expect(tooltip).toHaveAttribute('data-disabled', 'false');
    // Links inside keep working: the content is rendered, not stringified.
    expect(screen.getByRole('link')).toHaveAttribute('href', '/asset');
  });

  it('keeps the tooltip off when the text fits', () => {
    mockIsClamped = false;
    render(<ClampedText text="Short">Short</ClampedText>);

    expect(screen.getByTestId('tooltip')).toHaveAttribute(
      'data-disabled',
      'true'
    );
  });
});
