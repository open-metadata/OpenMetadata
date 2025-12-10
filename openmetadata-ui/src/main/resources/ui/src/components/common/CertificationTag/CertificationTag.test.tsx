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
import { MemoryRouter } from 'react-router-dom';
import { AssetCertification } from '../../../generated/entity/data/table';
import CertificationTag from './CertificationTag';
import { LabelType } from '../../../generated/type/tagLabel';
import { TagSource } from '../../../generated/type/tagLabel';
import { State } from '../../../generated/type/tagLabel';

const mockCertification: AssetCertification = {
  appliedDate: 1234567890,
  expiryDate: 1234567890,
  tagLabel: {
    tagFQN: 'Certification.Gold',
    name: 'Gold',
    displayName: 'Gold',
    description: 'Gold certified Data Asset.',
    labelType: LabelType.Manual,
    source: TagSource.Classification,
    state: State.Confirmed,
    style: {
      color: '#FFCE00',
      iconURL: 'GoldCertification.svg',
    },
  },
};

jest.mock('../../../utils/TagsUtils', () => ({
  getTagImageSrc: jest.fn().mockImplementation((iconURL) => iconURL || ''),
  getTagTooltip: jest
    .fn()
    .mockImplementation((name, description) => `${name}: ${description}`),
}));

jest.mock('../../../utils/RouterUtils', () => ({
  getClassificationTagPath: jest
    .fn()
    .mockImplementation((fqn) => `/tags/${fqn}`),
}));

const renderComponent = (
  certification = mockCertification,
  showName = false,
  isDisabled = false
) => {
  return render(
    <MemoryRouter>
      <CertificationTag
        certification={certification}
        isDisabled={isDisabled}
        showName={showName}
      />
    </MemoryRouter>
  );
};

describe('CertificationTag', () => {
  it('should render certification tag', () => {
    renderComponent();

    expect(
      screen.getByTestId('certification-Certification.Gold')
    ).toBeInTheDocument();
  });

  it('should render certification name when showName is true', () => {
    renderComponent(mockCertification, true);

    expect(screen.getByText('Gold')).toBeInTheDocument();
  });

  it('should not render certification name when showName is false', () => {
    renderComponent(mockCertification, false);

    expect(screen.queryByText('Gold')).not.toBeInTheDocument();
  });

  it('should render disabled badge when isDisabled is true', () => {
    renderComponent(mockCertification, true, true);

    expect(
      screen.getByTestId('certification-disabled-badge')
    ).toBeInTheDocument();
  });

  it('should not render disabled badge when isDisabled is false', () => {
    renderComponent(mockCertification, true, false);

    expect(
      screen.queryByTestId('certification-disabled-badge')
    ).not.toBeInTheDocument();
  });

  it('should apply disabled class when isDisabled is true', () => {
    renderComponent(mockCertification, true, true);

    const certificationLink = screen.getByTestId(
      'certification-Certification.Gold'
    );

    expect(certificationLink).toHaveClass('certification-tag-disabled');
  });

  it('should not apply disabled class when isDisabled is false', () => {
    renderComponent(mockCertification, true, false);

    const certificationLink = screen.getByTestId(
      'certification-Certification.Gold'
    );

    expect(certificationLink).not.toHaveClass('certification-tag-disabled');
  });

  it('should render certification icon when no iconURL is provided', () => {
    const certificationWithoutIcon: AssetCertification = {
      ...mockCertification,
      tagLabel: {
        ...mockCertification.tagLabel,
        style: undefined,
      },
    };

    renderComponent(certificationWithoutIcon);

    expect(
      screen.getByTestId('certification-Certification.Gold')
    ).toBeInTheDocument();
  });

  it('should render certification image when iconURL is provided', () => {
    renderComponent(mockCertification);

    const img = screen.getByRole('img');

    expect(img).toHaveAttribute('src', 'GoldCertification.svg');
  });

  it('should link to correct classification tag path', () => {
    renderComponent();

    const link = screen.getByTestId('certification-Certification.Gold');

    expect(link).toHaveAttribute('href', '/tags/Certification.Gold');
  });
});

