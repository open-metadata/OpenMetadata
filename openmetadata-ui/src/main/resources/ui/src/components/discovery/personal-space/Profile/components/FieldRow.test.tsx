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
import FieldRow from './FieldRow';

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  Typography: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
}));

describe('FieldRow', () => {
  it('splits the row 3/4 text, 1/4 right-aligned value, with no width cap on the text', () => {
    render(
      <FieldRow description="A long description" title="Title">
        <span data-testid="value">value</span>
      </FieldRow>
    );

    const text = screen.getByText('Title').parentElement as HTMLElement;
    const row = text.parentElement as HTMLElement;
    const value = screen.getByTestId('value').parentElement as HTMLElement;

    expect(row).toHaveClass('tw:grid', 'tw:grid-cols-[3fr_1fr]');
    expect(text.className).not.toMatch(/max-w/);
    expect(screen.getByText('A long description')).toBeInTheDocument();
    expect(value).toHaveClass('tw:items-end');
  });

  it('omits the description when none is given', () => {
    render(
      <FieldRow title="Title">
        <span>value</span>
      </FieldRow>
    );

    expect(screen.getByText('Title').parentElement?.children).toHaveLength(1);
  });
});
