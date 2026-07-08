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
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { Tag } from '../../generated/entity/classification/tag';
import { getTags } from '../../rest/tagAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import Certification from './Certification.component';

jest.mock('../../assets/svg/ic-certification.svg', () => ({
  ReactComponent: () => <div data-testid="certification-icon" />,
}));

jest.mock('../common/FocusTrap/FocusTrapWithContainer', () => ({
  FocusTrapWithContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock('../../rest/tagAPI', () => ({
  getTags: jest.fn(),
}));

const mockGetTags = getTags as jest.MockedFunction<typeof getTags>;

const mockCertifications: Tag[] = [
  {
    id: 'bronze-id',
    name: 'Bronze',
    displayName: 'Bronze',
    fullyQualifiedName: 'Certification.Bronze',
    description: 'Bronze certification',
  },
  {
    id: 'gold-id',
    name: 'Gold',
    displayName: 'Gold',
    fullyQualifiedName: 'Certification.Gold',
    description: 'Gold certification',
  },
  {
    id: 'silver-id',
    name: 'Silver',
    displayName: 'Silver',
    fullyQualifiedName: 'Certification.Silver',
    description: 'Silver certification',
  },
];

const mockOnCertificationUpdate = jest.fn().mockResolvedValue(undefined);
const mockOnClose = jest.fn();

const defaultProps = {
  permission: true,
  currentCertificate: 'Certification.Gold',
  onCertificationUpdate: mockOnCertificationUpdate,
  onClose: mockOnClose,
  children: <button data-testid="certification-trigger">Edit</button>,
  popoverProps: { open: true },
};

describe('Certification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTags.mockResolvedValue({
      data: mockCertifications,
      paging: { total: 3 },
    });
  });

  it('should render the trigger children', () => {
    render(<Certification {...defaultProps} popoverProps={{ open: false }} />);

    expect(screen.getByTestId('certification-trigger')).toBeInTheDocument();
  });

  it('should fetch certifications when the popover opens', async () => {
    render(<Certification {...defaultProps} />);

    await waitFor(() => {
      expect(mockGetTags).toHaveBeenCalledWith({
        parent: 'Certification',
        limit: 50,
        after: undefined,
        disabled: false,
      });
    });
  });

  it('should sort certifications with Gold, Silver, and Bronze first', async () => {
    render(<Certification {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('certification-cards')).toBeInTheDocument();
    });

    const radioButtons = screen.getAllByRole('radio');

    expect(radioButtons[0]).toHaveAttribute(
      'data-testid',
      'radio-btn-Certification.Gold'
    );
    expect(radioButtons[1]).toHaveAttribute(
      'data-testid',
      'radio-btn-Certification.Silver'
    );
    expect(radioButtons[2]).toHaveAttribute(
      'data-testid',
      'radio-btn-Certification.Bronze'
    );
  });

  it('should show an empty state when no certifications are available', async () => {
    mockGetTags.mockResolvedValueOnce({
      data: [],
      paging: { total: 0 },
    });

    render(<Certification {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('label.no-entity-available')).toBeInTheDocument();
    });
  });

  it('should select a certification when a card is clicked', async () => {
    render(<Certification {...defaultProps} currentCertificate="" />);

    await waitFor(() => {
      expect(
        screen.getByTestId('radio-btn-Certification.Silver')
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('radio-btn-Certification.Silver'));

    expect(screen.getByTestId('radio-btn-Certification.Silver')).toBeChecked();
  });

  it('should call onCertificationUpdate with the selected certification', async () => {
    render(<Certification {...defaultProps} />);

    await waitFor(() => {
      expect(
        screen.getByTestId('radio-btn-Certification.Gold')
      ).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('update-certification'));
    });

    await waitFor(() => {
      expect(mockOnCertificationUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          fullyQualifiedName: 'Certification.Gold',
        })
      );
    });
  });

  it('should clear the certification when clear is clicked', async () => {
    render(<Certification {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('clear-certification')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('clear-certification'));
    });

    await waitFor(() => {
      expect(mockOnCertificationUpdate).toHaveBeenCalledWith(undefined);
    });
  });

  it('should call onClose when the close button is clicked', async () => {
    render(<Certification {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('close-certification')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('close-certification'));

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should show an error toast when fetching certifications fails', async () => {
    const fetchError = new Error('fetch failed');
    mockGetTags.mockRejectedValueOnce(fetchError);

    render(<Certification {...defaultProps} />);

    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(
        fetchError,
        'server.entity-fetch-error'
      );
    });
  });

  it('should fetch certifications when the trigger is clicked', async () => {
    render(
      <Certification
        {...defaultProps}
        currentCertificate=""
        popoverProps={undefined}
      />
    );

    fireEvent.click(screen.getByTestId('certification-trigger'));

    await waitFor(() => {
      expect(mockGetTags).toHaveBeenCalledWith({
        parent: 'Certification',
        limit: 50,
        after: undefined,
        disabled: false,
      });
    });
  });
});
