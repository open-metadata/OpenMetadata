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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useHashPagingParams } from '../../../../../../hooks/useSettingsHash';
import { getAllPersonas } from '../../../../../../rest/PersonaAPI';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import PersonasLanding from './PersonasLanding';

jest.mock('react-i18next', () => {
  const t = (key: string) => key;

  return { useTranslation: () => ({ t }) };
});

jest.mock('../../../../../../rest/PersonaAPI', () => ({
  getAllPersonas: jest.fn(),
}));

jest.mock('../../../../../../hooks/useSettingsHash', () => ({
  useHashPagingParams: jest.fn(),
}));

jest.mock('../../../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock(
  '../../../../../common/RichTextEditor/RichTextEditorPreviewerV1',
  () =>
    ({ markdown }: { markdown: string }) =>
      <div data-testid="description-preview">{markdown}</div>
);

jest.mock('@openmetadata/ui-core-components', () => ({
  ...jest.requireActual('@openmetadata/ui-core-components'),
  PaginationCardWithControls: ({
    onPageChange,
    onPageSizeChange,
    page,
    total,
  }: {
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    page: number;
    total: number;
  }) => (
    <div data-testid="pagination">
      {`${page}/${total}`}
      <button type="button" onClick={() => onPageChange(page + 1)}>
        next
      </button>
      <button type="button" onClick={() => onPageChange(page - 1)}>
        previous
      </button>
      <button type="button" onClick={() => onPageSizeChange(25)}>
        size
      </button>
    </div>
  ),
}));

const PERSONAS = [
  {
    id: 'p1',
    name: 'analyst',
    displayName: 'Analyst',
    fullyQualifiedName: 'analyst',
    description: 'Analyses data',
    default: true,
  },
  { id: 'p2', name: 'engineer' },
];

const mockSetPage = jest.fn();

const mockPagingParams = (
  params: Partial<ReturnType<typeof useHashPagingParams>> = {}
) =>
  (useHashPagingParams as jest.Mock).mockReturnValue({
    page: 1,
    pageSize: undefined,
    cursor: undefined,
    cursorType: undefined,
    setPage: mockSetPage,
    ...params,
  });

const mockOnNavigate = jest.fn();

describe('PersonasLanding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPagingParams();
    (getAllPersonas as jest.Mock).mockResolvedValue({
      data: PERSONAS,
      paging: { total: 2 },
    });
  });

  it('lists persona cards with default badge and description', async () => {
    render(<PersonasLanding onNavigate={mockOnNavigate} />);

    expect(await screen.findByTestId('persona-card-analyst')).toHaveTextContent(
      'Analyst'
    );

    expect(getAllPersonas).toHaveBeenCalledWith({
      limit: 15,
      fields: 'users',
      after: undefined,
      before: undefined,
    });
    expect(screen.getByTestId('default-persona-tag')).toBeInTheDocument();
    expect(screen.getByTestId('description-preview')).toHaveTextContent(
      'Analyses data'
    );
    expect(screen.getByTestId('persona-card-engineer')).toHaveTextContent(
      'label.no-description'
    );
    expect(screen.getAllByTestId('default-persona-tag')).toHaveLength(1);
    expect(screen.queryByTestId('pagination')).not.toBeInTheDocument();
  });

  it('navigates to the persona detail on click and keyboard activation', async () => {
    render(<PersonasLanding onNavigate={mockOnNavigate} />);

    fireEvent.click(await screen.findByTestId('persona-card-analyst'));

    expect(mockOnNavigate).toHaveBeenCalledWith({
      type: 'detail',
      fqn: 'analyst',
      name: 'Analyst',
    });

    fireEvent.keyDown(screen.getByTestId('persona-card-engineer'), {
      key: 'Enter',
    });

    expect(mockOnNavigate).toHaveBeenLastCalledWith({
      type: 'detail',
      fqn: 'engineer',
      name: 'engineer',
    });
  });

  it('shows the empty state when there are no personas', async () => {
    (getAllPersonas as jest.Mock).mockResolvedValueOnce({
      data: [],
      paging: { total: 0 },
    });
    render(<PersonasLanding onNavigate={mockOnNavigate} />);

    expect(
      await screen.findByTestId('personas-landing-empty')
    ).toHaveTextContent('label.no-entity-found');
  });

  it('shows an error toast when loading fails', async () => {
    (getAllPersonas as jest.Mock).mockRejectedValueOnce(new Error('down'));
    render(<PersonasLanding onNavigate={mockOnNavigate} />);

    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());

    expect(screen.getByTestId('personas-landing-empty')).toBeInTheDocument();
  });

  it('pages forward with the after cursor and back to page one', async () => {
    (getAllPersonas as jest.Mock).mockResolvedValue({
      data: PERSONAS,
      paging: { total: 40, after: 'cursor-2' },
    });
    const { rerender } = render(
      <PersonasLanding onNavigate={mockOnNavigate} />
    );

    expect(await screen.findByTestId('pagination')).toHaveTextContent('1/3');

    (getAllPersonas as jest.Mock).mockResolvedValue({
      data: PERSONAS,
      paging: { total: 40, after: 'cursor-3', before: 'cursor-back-1' },
    });
    fireEvent.click(screen.getByText('next'));

    expect(mockSetPage).toHaveBeenCalledWith(2, 'after', 'cursor-2', 15);

    await waitFor(() =>
      expect(getAllPersonas).toHaveBeenLastCalledWith(
        expect.objectContaining({ after: 'cursor-2' })
      )
    );

    mockPagingParams({ page: 2, cursor: 'cursor-2', cursorType: 'after' });
    rerender(<PersonasLanding onNavigate={mockOnNavigate} />);

    fireEvent.click(screen.getByText('next'));

    expect(mockSetPage).toHaveBeenLastCalledWith(3, 'after', 'cursor-3', 15);

    fireEvent.click(screen.getByText('previous'));

    expect(mockSetPage).toHaveBeenLastCalledWith(1, undefined, undefined, 15);

    await waitFor(() =>
      expect(getAllPersonas).toHaveBeenLastCalledWith(
        expect.objectContaining({ after: undefined, before: undefined })
      )
    );
  });

  it('resumes from a cursor in the hash on mount', async () => {
    mockPagingParams({
      page: 3,
      pageSize: 25,
      cursor: 'cursor-x',
      cursorType: 'before',
    });
    render(<PersonasLanding onNavigate={mockOnNavigate} />);

    await screen.findByTestId('persona-card-analyst');

    expect(getAllPersonas).toHaveBeenCalledWith({
      limit: 25,
      fields: 'users',
      after: undefined,
      before: 'cursor-x',
    });
  });

  it('resets to page one when the hash has a page but no cursor', async () => {
    mockPagingParams({ page: 4 });
    render(<PersonasLanding onNavigate={mockOnNavigate} />);

    await screen.findByTestId('persona-card-analyst');

    expect(mockSetPage).toHaveBeenCalledWith(1, undefined, undefined, 15);
    expect(getAllPersonas).toHaveBeenCalledWith(
      expect.objectContaining({ after: undefined, before: undefined })
    );
  });

  it('resets to page one when the page size changes', async () => {
    (getAllPersonas as jest.Mock).mockResolvedValue({
      data: PERSONAS,
      paging: { total: 40, after: 'cursor-2' },
    });
    render(<PersonasLanding onNavigate={mockOnNavigate} />);

    fireEvent.click(await screen.findByText('size'));

    expect(mockSetPage).toHaveBeenCalledWith(1, undefined, undefined, 25);
  });
});
