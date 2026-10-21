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
import { ConstraintType } from '../../../../generated/entity/data/table';
import ConstraintIcon from './ConstraintIcon';

describe('ConstraintIcon', () => {
  it.each([
    ConstraintType.PrimaryKey,
    ConstraintType.Unique,
    ConstraintType.DistKey,
    ConstraintType.ClusterKey,
    ConstraintType.SortKey,
  ])('exposes the %s icon to assistive tech as a labelled image', (type) => {
    render(<ConstraintIcon showOnlyIcon constraintType={type} />);

    const icon = screen.getByRole('img', { name: type });

    expect(icon).not.toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId(type + '-icon')).toBeInTheDocument();
  });

  it('draws the decorative section line only when the label is shown', () => {
    const { container, rerender } = render(
      <ConstraintIcon
        constraintType={ConstraintType.PrimaryKey}
        showOnlyIcon={false}
      />
    );

    expect(
      container.querySelector('.primary-key-section-line')
    ).toBeInTheDocument();

    rerender(
      <ConstraintIcon showOnlyIcon constraintType={ConstraintType.PrimaryKey} />
    );

    expect(
      container.querySelector('.primary-key-section-line')
    ).not.toBeInTheDocument();
  });
});
