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
import { SearchIndex } from '../../enums/search.enum';
import { Tag } from '../../generated/entity/classification/tag';
import { searchQuery } from '../../rest/searchAPI';
import { showErrorToast } from '../../utils/ToastUtils';
import Certification from './Certification.component';

jest.mock('../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

const mockSearchQuery = searchQuery as jest.Mock;

const searchResponse = (tags: Tag[], total = tags.length) => ({
  hits: {
    hits: tags.map((tag) => ({ _source: tag })),
    total: { value: total },
  },
});

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

const FETCH_PARAMS = expect.objectContaining({
  query: '',
  pageNumber: 1,
  pageSize: 50,
  searchIndex: SearchIndex.TAG,
});

const scrollToEnd = () => {
  const menu = screen.getByRole('menu');
  Object.defineProperties(menu, {
    scrollHeight: { configurable: true, value: 400 },
    clientHeight: { configurable: true, value: 200 },
  });
  menu.scrollTop = 200;
  fireEvent.scroll(menu);
};

describe('Certification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchQuery.mockResolvedValue(searchResponse(mockCertifications));
  });

  it('should render the trigger children', () => {
    render(<Certification {...defaultProps} popoverProps={{ open: false }} />);

    expect(screen.getByTestId('certification-trigger')).toBeInTheDocument();
    expect(mockSearchQuery).not.toHaveBeenCalled();
  });

  it('should fetch certifications when the popover opens', async () => {
    render(<Certification {...defaultProps} />);

    await waitFor(() => {
      expect(mockSearchQuery).toHaveBeenCalledWith(FETCH_PARAMS);
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
    mockSearchQuery.mockResolvedValueOnce(searchResponse([]));

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
    mockSearchQuery.mockRejectedValueOnce(fetchError);

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
    expect(mockSearchQuery).toHaveBeenCalledWith(FETCH_PARAMS);
  });

  it('should load the next page when the list is scrolled to its end', async () => {
    mockSearchQuery
      .mockResolvedValueOnce(searchResponse([mockCertifications[0]], 2))
      .mockResolvedValueOnce(searchResponse([mockCertifications[1]], 2));

    render(<Certification {...defaultProps} />);

    await screen.findByTestId('Certification.Bronze');
    scrollToEnd();

    expect(await screen.findByTestId('Certification.Gold')).toBeInTheDocument();
    expect(mockSearchQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageNumber: 2 })
    );
  });

  it('should not load more once every certification is listed', async () => {
    render(<Certification {...defaultProps} />);

    await screen.findByTestId('Certification.Gold');
    scrollToEnd();

    expect(mockSearchQuery).toHaveBeenCalledTimes(1);
  });

  it('should search certifications on the server', async () => {
    render(<Certification {...defaultProps} />);

    await screen.findByTestId('Certification.Gold');
    fireEvent.change(screen.getByTestId('search-input'), {
      target: { value: 'gol' },
    });

    await waitFor(() =>
      expect(mockSearchQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ query: '*gol*', pageNumber: 1 })
      )
    );
  });

  it('should show a form field value by name before it is opened', async () => {
    render(
      <Certification
        {...defaultProps}
        currentCertificate="Certification.Gold"
        popoverProps={undefined}>
        {undefined}
      </Certification>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Gold' }));
    await screen.findByTestId('Certification.Silver');

    expect(mockSearchQuery).toHaveBeenCalledTimes(2);
  });

  it('should drop the results of a search the user has moved past', async () => {
    let finishFirstSearch!: (value: unknown) => void;
    mockSearchQuery
      .mockResolvedValueOnce(searchResponse(mockCertifications))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishFirstSearch = resolve;
          })
      )
      .mockResolvedValueOnce(searchResponse([mockCertifications[2]]));

    render(<Certification {...defaultProps} currentCertificate="" />);

    await screen.findByTestId('Certification.Bronze');
    const searchInput = screen.getByTestId('search-input');
    fireEvent.change(searchInput, { target: { value: 'bro' } });
    await waitFor(() => expect(mockSearchQuery).toHaveBeenCalledTimes(2));
    fireEvent.change(searchInput, { target: { value: 'sil' } });
    await screen.findByTestId('Certification.Silver');

    await act(async () => {
      finishFirstSearch(searchResponse([mockCertifications[0]]));
    });

    expect(screen.getByTestId('Certification.Silver')).toBeInTheDocument();
    expect(
      screen.queryByTestId('Certification.Bronze')
    ).not.toBeInTheDocument();
  });

  it('should keep the selected label when a search no longer lists it', async () => {
    render(
      <Certification
        {...defaultProps}
        currentCertificate="Certification.Gold"
        popoverProps={undefined}>
        {undefined}
      </Certification>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Gold' }));
    await screen.findByTestId('Certification.Gold');
    mockSearchQuery.mockResolvedValueOnce(
      searchResponse([mockCertifications[2]])
    );
    fireEvent.change(screen.getByTestId('search-input'), {
      target: { value: 'sil' },
    });
    await waitFor(() =>
      expect(mockSearchQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ query: '*sil*' })
      )
    );
    await waitFor(() =>
      expect(
        screen.queryByTestId('Certification.Bronze')
      ).not.toBeInTheDocument()
    );
    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(
      await screen.findByRole('button', { name: 'Gold' })
    ).toBeInTheDocument();
  });

  it('should reload the full list at once when reopened after a search', async () => {
    render(
      <Certification
        {...defaultProps}
        currentCertificate=""
        popoverProps={undefined}
      />
    );

    fireEvent.click(screen.getByTestId('certification-trigger'));
    await screen.findByTestId('Certification.Silver');
    fireEvent.change(screen.getByTestId('search-input'), {
      target: { value: 'sil' },
    });
    await waitFor(() => expect(mockSearchQuery).toHaveBeenCalledTimes(2));
    fireEvent.keyDown(document.body, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('certification-trigger'));

    await waitFor(() => expect(mockSearchQuery).toHaveBeenCalledTimes(3));

    expect(mockSearchQuery).toHaveBeenLastCalledWith(FETCH_PARAMS);
  });

  it('should not report a pick as a dismissal to onClose', async () => {
    render(<Certification {...defaultProps} />);

    fireEvent.click(await screen.findByTestId('Certification.Silver'));

    await waitFor(() => expect(mockOnCertificationUpdate).toHaveBeenCalled());

    expect(mockOnClose).not.toHaveBeenCalled();
  });
});
