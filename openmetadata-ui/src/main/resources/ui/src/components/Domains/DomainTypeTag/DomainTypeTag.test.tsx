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
import { DomainType } from '../../../generated/entity/domains/domain';
import { DomainTypeTag } from './DomainTypeTag.component';

const mockProps = {
  domainType: DomainType.Aggregate,
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('DomainTypeTag', () => {
  it('should render domain type tag with correct label', () => {
    render(<DomainTypeTag {...mockProps} />);

    expect(screen.getByText('label.aggregate')).toBeInTheDocument();
  });

  it('should render with correct CSS classes', () => {
    const { container } = render(<DomainTypeTag {...mockProps} />);

    const tag = container.querySelector('.domain-type-tag');

    expect(tag).toHaveClass('aggregate-domain-type');
  });

  it('should render with custom className', () => {
    const { container } = render(
      <DomainTypeTag {...mockProps} className="custom-class" />
    );

    const tag = container.querySelector('.domain-type-tag');

    expect(tag).toHaveClass('custom-class');
  });

  it('should render disabled state', () => {
    const { container } = render(<DomainTypeTag {...mockProps} disabled />);

    const tag = container.querySelector('.domain-type-tag');

    expect(tag).toHaveClass('disabled');
  });

  it('should render different sizes', () => {
    const { container } = render(<DomainTypeTag {...mockProps} size="small" />);

    const tag = container.querySelector('.domain-type-tag');

    expect(tag).toHaveClass('small');
  });
});
