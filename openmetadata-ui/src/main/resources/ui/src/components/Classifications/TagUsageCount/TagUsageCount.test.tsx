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
import { MemoryRouter } from 'react-router-dom';
import { Tag } from '../../../generated/entity/classification/tag';
import { TagUsageCount } from './TagUsageCount.component';

const mockTag = {
  id: 'tag-1',
  name: 'Sensitive',
  fullyQualifiedName: 'PII.Sensitive',
} as Tag;

const renderCount = (props: Partial<Parameters<typeof TagUsageCount>[0]>) =>
  render(<TagUsageCount record={mockTag} {...props} />, {
    wrapper: MemoryRouter,
  });

describe('TagUsageCount', () => {
  it('should render a loader while the aggregation is in flight', () => {
    const { container } = renderCount({ isLoading: true });

    expect(container.querySelector('.tw\\:animate-pulse')).toBeInTheDocument();
    expect(screen.queryByTestId('usage-count-Sensitive')).toBeNull();
  });

  it('should render a placeholder when the counts are unknown', () => {
    renderCount({ usageCounts: undefined });

    expect(screen.getByTestId('usage-count-Sensitive')).toHaveTextContent('--');
  });

  it('should render a plain zero when the tag has no assets', () => {
    renderCount({ usageCounts: { 'pii.other': 4 } });

    const count = screen.getByTestId('usage-count-Sensitive');

    expect(count).toHaveTextContent('0');
    expect(count.closest('a')).toBeNull();
  });

  it('should link a non-zero count to the assets tab of the tag', () => {
    renderCount({ usageCounts: { 'pii.sensitive': 12 } });

    const count = screen.getByTestId('usage-count-Sensitive');

    expect(count).toHaveTextContent('12');
    expect(count).toHaveAttribute('href', '/tag/PII.Sensitive/assets');
  });

  it('should match the bucket regardless of the FQN casing', () => {
    renderCount({ usageCounts: { 'pii.sensitive': 5 } });

    expect(screen.getByTestId('usage-count-Sensitive')).toHaveTextContent('5');
  });
});
