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
import { EntityStatus } from '../../../generated/entity/data/metric';
import MetricStatusPill from './MetricStatusPill.component';

const translations: Record<string, string> = {
  'label.approved': 'Approved',
  'label.archived': 'Archived',
  'label.deprecated': 'Deprecated',
  'label.draft': 'Draft',
  'label.in-review': 'In Review',
  'label.rejected': 'Rejected',
  'label.unprocessed': 'Unprocessed',
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => translations[key] ?? key,
  }),
}));

describe('MetricStatusPill', () => {
  it.each([
    [EntityStatus.Approved, 'Approved'],
    [EntityStatus.InReview, 'In Review'],
    [EntityStatus.Draft, 'Draft'],
    [EntityStatus.Rejected, 'Rejected'],
    [EntityStatus.Deprecated, 'Deprecated'],
    [EntityStatus.Archived, 'Archived'],
    [EntityStatus.Unprocessed, 'Unprocessed'],
  ])('renders an accessible %s status', (status, label) => {
    render(<MetricStatusPill status={status} />);

    expect(screen.getByTestId('metric-status-pill')).toHaveAccessibleName(
      label
    );
    expect(
      screen.getByTestId('metric-status-pill').querySelector('svg')
    ).toHaveAttribute('aria-hidden', 'true');
  });

  it('omits a missing status', () => {
    const { container } = render(<MetricStatusPill />);

    expect(container).toBeEmptyDOMElement();
  });
});
