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
import { DataQualityProgressSegment } from './DataQualityProgressSegment';

describe('DataQualityProgressSegment', () => {
  it('should render segment with correct width percentage', () => {
    const { container } = render(
      <DataQualityProgressSegment percent={50} type="success" />
    );

    const segment = container.querySelector('.progress-segment');

    expect(segment).toBeInTheDocument();
    expect(segment).toHaveStyle({ width: '50%' });
  });

  it('should apply success class', () => {
    const { container } = render(
      <DataQualityProgressSegment percent={50} type="success" />
    );

    const segment = container.querySelector('.progress-segment');

    expect(segment).toHaveClass('success');
  });

  it('should apply aborted class', () => {
    const { container } = render(
      <DataQualityProgressSegment percent={25} type="aborted" />
    );

    const segment = container.querySelector('.progress-segment');

    expect(segment).toHaveClass('aborted');
  });

  it('should apply failed class', () => {
    const { container } = render(
      <DataQualityProgressSegment percent={25} type="failed" />
    );

    const segment = container.querySelector('.progress-segment');

    expect(segment).toHaveClass('failed');
  });

  it('should return null when percent is 0', () => {
    const { container } = render(
      <DataQualityProgressSegment percent={0} type="success" />
    );

    const segment = container.querySelector('.progress-segment');

    expect(segment).not.toBeInTheDocument();
  });

  it('should return null when percent is negative', () => {
    const { container } = render(
      <DataQualityProgressSegment percent={-10} type="success" />
    );

    const segment = container.querySelector('.progress-segment');

    expect(segment).not.toBeInTheDocument();
  });

  it('should render segment with 100% width', () => {
    const { container } = render(
      <DataQualityProgressSegment percent={100} type="success" />
    );

    const segment = container.querySelector('.progress-segment');

    expect(segment).toHaveStyle({ width: '100%' });
  });

  it('should render segment with decimal percent', () => {
    const { container } = render(
      <DataQualityProgressSegment percent={33.33} type="success" />
    );

    const segment = container.querySelector('.progress-segment');

    expect(segment).toHaveStyle({ width: '33.33%' });
  });

  it('should render segment with very small percent', () => {
    const { container } = render(
      <DataQualityProgressSegment percent={0.1} type="success" />
    );

    const segment = container.querySelector('.progress-segment');

    expect(segment).toBeInTheDocument();
    expect(segment).toHaveStyle({ width: '0.1%' });
  });

  it('should have correct CSS classes structure', () => {
    const { container } = render(
      <DataQualityProgressSegment percent={50} type="success" />
    );

    const segment = container.querySelector('.progress-segment');

    expect(segment).toHaveClass('progress-segment');
    expect(segment).toHaveClass('success');
  });
});
