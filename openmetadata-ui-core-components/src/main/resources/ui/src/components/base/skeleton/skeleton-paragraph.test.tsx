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
import { describe, expect, it } from 'vitest';
import { SkeletonParagraph } from './skeleton-paragraph';

const lines = (container: HTMLElement) =>
  Array.from(container.firstElementChild?.children ?? []) as HTMLElement[];

describe('SkeletonParagraph', () => {
  it('renders a 40% title and three rows with a 60% last row by default', () => {
    const { container } = render(<SkeletonParagraph />);
    const widths = lines(container).map((line) => line.style.width);

    expect(widths).toEqual(['40%', '100%', '100%', '60%']);
  });

  it('omits the title and honours a custom row count', () => {
    const { container } = render(<SkeletonParagraph rows={2} title={false} />);
    const widths = lines(container).map((line) => line.style.width);

    expect(widths).toEqual(['100%', '60%']);
  });
});
