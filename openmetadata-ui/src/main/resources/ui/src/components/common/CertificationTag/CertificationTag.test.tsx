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
import { AssetCertification } from '../../../generated/type/assetCertification';
import { LabelType, State, TagSource } from '../../../generated/type/tagLabel';
import { getClassificationTagPath } from '../../../utils/RouterUtils';
import CertificationTag from './CertificationTag';

jest.mock('../../../assets/svg/ic-certification.svg', () => ({
  ReactComponent: () => <div data-testid="default-certification-icon" />,
}));

jest.mock('../../../utils/IconUtils', () => ({
  renderIcon: jest.fn(),
}));

const { renderIcon } = jest.requireMock('../../../utils/IconUtils');

const mockCertification: AssetCertification = {
  tagLabel: {
    tagFQN: 'Certification.Gold',
    name: 'Gold',
    displayName: 'Gold Medal',
    description: 'Gold certified data asset',
    style: {
      color: '#FFD700',
      iconURL: 'https://example.com/gold.png',
    },
    source: TagSource.Classification,
    labelType: LabelType.Manual,
    state: State.Confirmed,
  },
  appliedDate: 1732814645688,
  expiryDate: 1735406645688,
};

const renderCertificationTag = (
  certification = mockCertification,
  showName = false
) =>
  render(
    <MemoryRouter>
      <CertificationTag certification={certification} showName={showName} />
    </MemoryRouter>
  );

describe('CertificationTag', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    renderIcon.mockReturnValue(
      <img alt="icon" data-testid="custom-certification-icon" />
    );
  });

  it('should render a link with the certification tag test id', () => {
    renderCertificationTag();

    expect(
      screen.getByTestId('certification-Certification.Gold')
    ).toBeInTheDocument();
  });

  it('should link to the classification tag path', () => {
    renderCertificationTag();

    const link = screen.getByTestId('certification-Certification.Gold');

    expect(link).toHaveAttribute(
      'href',
      getClassificationTagPath('Certification.Gold')
    );
  });

  it('should render the certification name when showName is true', () => {
    renderCertificationTag(mockCertification, true);

    expect(screen.getByText('Gold Medal')).toBeInTheDocument();
  });

  it('should not render the certification name when showName is false', () => {
    renderCertificationTag(mockCertification, false);

    expect(screen.queryByText('Gold Medal')).not.toBeInTheDocument();
  });

  it('should render a custom icon when iconURL is provided', () => {
    renderCertificationTag();

    expect(screen.getByTestId('custom-certification-icon')).toBeInTheDocument();
    expect(renderIcon).toHaveBeenCalledWith(
      'https://example.com/gold.png',
      expect.objectContaining({
        size: 28,
        className: 'certification-img',
      })
    );
  });

  it('should use a smaller icon size when showName is true', () => {
    renderCertificationTag(mockCertification, true);

    expect(renderIcon).toHaveBeenCalledWith(
      'https://example.com/gold.png',
      expect.objectContaining({
        size: 16,
      })
    );
  });

  it('should render the default icon when iconURL is not provided', () => {
    renderIcon.mockReturnValue(null);

    const certificationWithoutIcon: AssetCertification = {
      ...mockCertification,
      tagLabel: {
        ...mockCertification.tagLabel,
        style: {
          color: '#FFD700',
        },
      },
    };

    renderCertificationTag(certificationWithoutIcon);

    expect(
      screen.getByTestId('default-certification-icon')
    ).toBeInTheDocument();
  });

  it('should apply background color styling when showName is true', () => {
    renderCertificationTag(mockCertification, true);

    const link = screen.getByTestId('certification-Certification.Gold');

    expect(link).toHaveStyle({ backgroundColor: '#FFD70033' });
  });
});
