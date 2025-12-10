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

import { act, fireEvent, render, screen } from '@testing-library/react';
import Certification from './Certification.component';

const mockCertificationData = [
  {
    id: 'bronze-id',
    name: 'Bronze',
    fullyQualifiedName: 'Certification.Bronze',
    description: 'Bronze certified Data Asset.',
    style: {
      color: '#C08329',
      iconURL: 'BronzeCertification.svg',
    },
    disabled: false,
  },
  {
    id: 'gold-id',
    name: 'Gold',
    fullyQualifiedName: 'Certification.Gold',
    description: 'Gold certified Data Asset.',
    style: {
      color: '#FFCE00',
      iconURL: 'GoldCertification.svg',
    },
    disabled: false,
  },
  {
    id: 'silver-id',
    name: 'Silver',
    fullyQualifiedName: 'Certification.Silver',
    description: 'Silver certified Data Asset.',
    style: {
      color: '#ADADAD',
      iconURL: 'SilverCertification.svg',
    },
    disabled: false,
  },
];

const mockDisabledCertificationData = [
  {
    id: 'gold-id',
    name: 'Gold',
    fullyQualifiedName: 'Certification.Gold',
    description: 'Gold certified Data Asset.',
    disabled: true,
  },
  {
    id: 'silver-id',
    name: 'Silver',
    fullyQualifiedName: 'Certification.Silver',
    description: 'Silver certified Data Asset.',
    disabled: true,
  },
];

const mockGetTags = jest.fn().mockImplementation(() =>
  Promise.resolve({
    data: mockCertificationData,
    paging: { total: 3 },
  })
);

const mockOnCertificationUpdate = jest.fn().mockResolvedValue(undefined);
const mockOnClose = jest.fn();
const mockShowErrorToast = jest.fn();

const mockProps = {
  permission: true,
  onCertificationUpdate: mockOnCertificationUpdate,
  onClose: mockOnClose,
  currentCertificate: '',
  children: <button data-testid="trigger-button">Edit Certification</button>,
};

jest.mock('../../rest/tagAPI', () => ({
  getTags: jest.fn().mockImplementation(() => mockGetTags()),
}));

jest.mock('../common/Loader/Loader', () => {
  return jest.fn().mockReturnValue(<div data-testid="loader">Loader</div>);
});

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn().mockImplementation(() => mockShowErrorToast()),
}));

jest.mock('../../utils/TagsUtils', () => ({
  getTagImageSrc: jest.fn().mockImplementation((iconURL) => iconURL || ''),
}));

jest.mock('../../utils/StringsUtils', () => ({
  stringToHTML: jest.fn().mockImplementation((str) => str),
}));

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Popover: jest
    .fn()
    .mockImplementation(({ content, onOpenChange, children }) => {
      onOpenChange(true);

      return (
        <>
          {content}
          {children}
        </>
      );
    }),
}));

jest.mock('../common/FocusTrap/FocusTrapWithContainer', () => ({
  FocusTrapWithContainer: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
}));

describe('Certification Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTags.mockImplementation(() =>
      Promise.resolve({
        data: mockCertificationData,
        paging: { total: 3 },
      })
    );
  });

  it('should render the certification card', async () => {
    await act(async () => {
      render(<Certification {...mockProps} />);
    });

    expect(mockGetTags).toHaveBeenCalledWith({
      parent: 'Certification',
      limit: 50,
      after: undefined,
    });

    expect(
      await screen.findByTestId('certification-cards')
    ).toBeInTheDocument();
  });

  it('should render children element', async () => {
    await act(async () => {
      render(<Certification {...mockProps} />);
    });

    expect(await screen.findByTestId('trigger-button')).toBeInTheDocument();
  });

  it('should filter out disabled certifications', async () => {
    mockGetTags.mockImplementationOnce(() =>
      Promise.resolve({
        data: mockDisabledCertificationData,
        paging: { total: 2 },
      })
    );

    await act(async () => {
      render(<Certification {...mockProps} />);
    });

    expect(
      await screen.findByText('message.no-data-available')
    ).toBeInTheDocument();
  });

  it('should sort certifications with Gold, Silver, Bronze first', async () => {
    await act(async () => {
      render(<Certification {...mockProps} />);
    });

    const radioButtons = await screen.findAllByRole('radio');

    expect(radioButtons[0]).toHaveAttribute(
      'value',
      'Certification.Gold'
    );
    expect(radioButtons[1]).toHaveAttribute(
      'value',
      'Certification.Silver'
    );
    expect(radioButtons[2]).toHaveAttribute(
      'value',
      'Certification.Bronze'
    );
  });

  it('should show empty state when no certifications are available', async () => {
    mockGetTags.mockImplementationOnce(() =>
      Promise.resolve({
        data: [],
        paging: { total: 0 },
      })
    );

    await act(async () => {
      render(<Certification {...mockProps} />);
    });

    expect(
      await screen.findByText('message.no-data-available')
    ).toBeInTheDocument();
  });

  it('should call onCertificationUpdate when selecting a certification and clicking update', async () => {
    await act(async () => {
      render(<Certification {...mockProps} />);
    });

    const goldRadioButton = await screen.findByTestId(
      'radio-btn-Certification.Gold'
    );

    await act(async () => {
      fireEvent.click(goldRadioButton);
    });

    const updateButton = await screen.findByTestId('update-certification');

    await act(async () => {
      fireEvent.click(updateButton);
    });

    expect(mockOnCertificationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        fullyQualifiedName: 'Certification.Gold',
      })
    );
  });

  it('should call onCertificationUpdate with undefined when clicking clear', async () => {
    await act(async () => {
      render(<Certification {...mockProps} />);
    });

    const clearButton = await screen.findByTestId('clear-certification');

    await act(async () => {
      fireEvent.click(clearButton);
    });

    expect(mockOnCertificationUpdate).toHaveBeenCalledWith(undefined);
  });

  it('should call onClose when clicking close button', async () => {
    await act(async () => {
      render(<Certification {...mockProps} />);
    });

    const closeButton = await screen.findByTestId('close-certification');

    await act(async () => {
      fireEvent.click(closeButton);
    });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should fetch certifications when popoverProps.open is true', async () => {
    await act(async () => {
      render(<Certification {...mockProps} popoverProps={{ open: true }} />);
    });

    expect(mockGetTags).toHaveBeenCalled();
  });

  it('should handle keyboard navigation for clear button', async () => {
    await act(async () => {
      render(<Certification {...mockProps} />);
    });

    const clearButton = await screen.findByTestId('clear-certification');

    await act(async () => {
      fireEvent.keyDown(clearButton, { key: 'Enter' });
    });

    expect(mockOnCertificationUpdate).toHaveBeenCalledWith(undefined);
  });

  it('should handle keyboard navigation with space key for clear button', async () => {
    await act(async () => {
      render(<Certification {...mockProps} />);
    });

    const clearButton = await screen.findByTestId('clear-certification');

    await act(async () => {
      fireEvent.keyDown(clearButton, { key: ' ' });
    });

    expect(mockOnCertificationUpdate).toHaveBeenCalledWith(undefined);
  });

  it('should display certification with current certificate selected', async () => {
    await act(async () => {
      render(
        <Certification
          {...mockProps}
          currentCertificate="Certification.Gold"
        />
      );
    });

    const goldRadioButton = await screen.findByTestId(
      'radio-btn-Certification.Gold'
    );

    expect(goldRadioButton).toBeInTheDocument();
  });

  it('should render certification items with correct content', async () => {
    await act(async () => {
      render(<Certification {...mockProps} />);
    });

    expect(await screen.findByText('Gold')).toBeInTheDocument();
    expect(await screen.findByText('Silver')).toBeInTheDocument();
    expect(await screen.findByText('Bronze')).toBeInTheDocument();
  });

  it('should render certification descriptions', async () => {
    await act(async () => {
      render(<Certification {...mockProps} />);
    });

    expect(
      await screen.findByText('Gold certified Data Asset.')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Silver certified Data Asset.')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Bronze certified Data Asset.')
    ).toBeInTheDocument();
  });
});

