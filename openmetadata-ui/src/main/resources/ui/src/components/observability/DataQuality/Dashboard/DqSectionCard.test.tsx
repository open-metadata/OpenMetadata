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
import DqSectionCard from './DqSectionCard';

/* eslint-disable @typescript-eslint/no-explicit-any */
jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({ children, className, direction, gap }: any) => (
    <div
      className={className}
      data-direction={direction}
      data-gap={gap}
      data-testid="box">
      {children}
    </div>
  ),
  Typography: ({ children, size, weight, className }: any) => (
    <span
      className={className}
      data-size={size}
      data-testid="typography"
      data-weight={weight}>
      {children}
    </span>
  ),
}));

describe('DqSectionCard', () => {
  it('should render the title', () => {
    render(
      <DqSectionCard title="Section Title">
        <div>content</div>
      </DqSectionCard>
    );

    expect(screen.getByText('Section Title')).toBeInTheDocument();
  });

  it('should render children', () => {
    render(
      <DqSectionCard title="Section Title">
        <div data-testid="child">Child Content</div>
      </DqSectionCard>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('should render subtitle when provided', () => {
    render(
      <DqSectionCard subtitle="A subtitle" title="Section Title">
        <div>content</div>
      </DqSectionCard>
    );

    expect(screen.getByText('A subtitle')).toBeInTheDocument();
  });

  it('should not render subtitle when not provided', () => {
    render(
      <DqSectionCard title="Section Title">
        <div>content</div>
      </DqSectionCard>
    );

    expect(screen.queryByText('A subtitle')).not.toBeInTheDocument();
  });

  it('should always include the export-pdf-container class', () => {
    const { container } = render(
      <DqSectionCard title="Section Title">
        <div>content</div>
      </DqSectionCard>
    );

    expect(
      container.querySelector('.export-pdf-container')
    ).toBeInTheDocument();
  });

  it('should append a custom className', () => {
    const { container } = render(
      <DqSectionCard className="my-custom-class" title="Section Title">
        <div>content</div>
      </DqSectionCard>
    );

    const root = container.querySelector('.export-pdf-container');

    expect(root).toHaveClass('my-custom-class');
  });

  it('should render ReactNode titles and subtitles', () => {
    render(
      <DqSectionCard
        subtitle={<span data-testid="node-subtitle">Node Subtitle</span>}
        title={<span data-testid="node-title">Node Title</span>}>
        <div>content</div>
      </DqSectionCard>
    );

    expect(screen.getByTestId('node-title')).toBeInTheDocument();
    expect(screen.getByTestId('node-subtitle')).toBeInTheDocument();
  });
});
