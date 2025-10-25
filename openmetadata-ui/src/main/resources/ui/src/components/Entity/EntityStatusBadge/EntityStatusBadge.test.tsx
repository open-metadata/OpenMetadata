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
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import { EntityStatusBadge } from './EntityStatusBadge.component';

describe('EntityStatusBadge', () => {
  it('should render status badge with divider by default', () => {
    render(<EntityStatusBadge status={EntityStatus.Approved} />);

    expect(screen.getByText(EntityStatus.Approved)).toBeInTheDocument();
  });

  it('should render status badge without divider when showDivider is false', () => {
    const { container } = render(
      <EntityStatusBadge showDivider={false} status={EntityStatus.Draft} />
    );

    expect(screen.getByText(EntityStatus.Draft)).toBeInTheDocument();
    expect(container.querySelector('.ant-divider')).not.toBeInTheDocument();
  });

  it('should render all entity status types', () => {
    const statuses = [
      EntityStatus.Approved,
      EntityStatus.Draft,
      EntityStatus.InReview,
      EntityStatus.Rejected,
      EntityStatus.Deprecated,
    ];

    statuses.forEach((status) => {
      const { unmount } = render(
        <EntityStatusBadge showDivider={false} status={status} />
      );

      expect(screen.getByText(status)).toBeInTheDocument();

      unmount();
    });
  });
});
