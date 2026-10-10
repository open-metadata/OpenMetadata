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

const FETCH_PARAMS = {
  parent: 'Certification',
  limit: 50,
  disabled: false,
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
    expect(mockGetTags).not.toHaveBeenCalled();
  });

  it('should fetch certifications when the popover opens', async () => {
    render(<Certification {...defaultProps} />);

    await waitFor(() => {
      expect(mockGetTags).toHaveBeenCalledWith(FETCH_PARAMS);
    });
  });

  it('should list Gold, Silver, and Bronze first as radio rows', async () => {
    render(<Certification {...defaultProps} />);

    const rows = await screen.findAllByRole('menuitemradio');

    expect(rows.map((row) => row.dataset.testid)).toEqual([
      'Certification.Gold',
      'Certification.Silver',
      'Certification.Bronze',
    ]);
    expect(screen.getByTestId('Certification.Gold')).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });

  it('should show an empty state when no certifications are available', async () => {
    mockGetTags.mockResolvedValueOnce({
      data: [],
      paging: { total: 0 },
    });

    render(<Certification {...defaultProps} currentCertificate="" />);

    expect(
      await screen.findByText('label.no-entity-available')
    ).toBeInTheDocument();
  });

  it('should update with the picked certification', async () => {
    render(<Certification {...defaultProps} />);

    fireEvent.click(await screen.findByTestId('Certification.Silver'));

    await waitFor(() => {
      expect(mockOnCertificationUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          fullyQualifiedName: 'Certification.Silver',
        })
      );
    });
  });

  it('should clear the certification from the footer', async () => {
    render(<Certification {...defaultProps} />);

    await screen.findByTestId('Certification.Gold');

    await act(async () => {
      fireEvent.click(screen.getByTestId('clear-filter-btn'));
    });

    expect(mockOnCertificationUpdate).toHaveBeenCalledWith(undefined);
  });

  it('should call onClose when dismissed with Escape', async () => {
    render(<Certification {...defaultProps} />);

    await screen.findByTestId('Certification.Gold');
    fireEvent.keyDown(document.body, { key: 'Escape' });

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

  it('should open and fetch when the trigger is clicked', async () => {
    render(
      <Certification
        {...defaultProps}
        currentCertificate=""
        popoverProps={undefined}
      />
    );

    fireEvent.click(screen.getByTestId('certification-trigger'));

    expect(
      await screen.findByTestId('Certification.Silver')
    ).toBeInTheDocument();
    expect(mockGetTags).toHaveBeenCalledWith(FETCH_PARAMS);
  });

  it('should list certifications from every page', async () => {
    mockGetTags
      .mockResolvedValueOnce({
        data: [mockCertifications[0]],
        paging: { total: 2, after: 'page-2' },
      })
      .mockResolvedValueOnce({
        data: [mockCertifications[1]],
        paging: { total: 2 },
      });

    render(<Certification {...defaultProps} />);

    expect(await screen.findByTestId('Certification.Gold')).toBeInTheDocument();
    expect(screen.getByTestId('Certification.Bronze')).toBeInTheDocument();
    expect(mockGetTags).toHaveBeenLastCalledWith({
      ...FETCH_PARAMS,
      after: 'page-2',
    });
  });

  it('should fetch a form field once, not on every open and close', async () => {
    render(
      <Certification
        {...defaultProps}
        currentCertificate="Certification.Gold"
        popoverProps={undefined}>
        {undefined}
      </Certification>
    );

    const trigger = await screen.findByRole('button', { name: 'Gold' });
    fireEvent.click(trigger);
    await screen.findByTestId('Certification.Silver');
    fireEvent.keyDown(document.body, { key: 'Escape' });
    fireEvent.click(trigger);
    await screen.findByTestId('Certification.Silver');

    expect(mockGetTags).toHaveBeenCalledTimes(1);
  });

  it('should not report a pick as a dismissal to onClose', async () => {
    render(<Certification {...defaultProps} />);

    fireEvent.click(await screen.findByTestId('Certification.Silver'));

    await waitFor(() => expect(mockOnCertificationUpdate).toHaveBeenCalled());

    expect(mockOnClose).not.toHaveBeenCalled();
  });
});
