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

import { act, render, screen } from '@testing-library/react';
import { getFirstLevelGlossaryTermsPaginated } from '../../../rest/glossaryAPI';
import GlossaryTermChildrenCountBadge from './GlossaryTermChildrenCountBadge.component';

jest.mock('../../../rest/glossaryAPI', () => ({
  getFirstLevelGlossaryTermsPaginated: jest.fn(),
}));

const mockGetFirstLevelGlossaryTermsPaginated =
  getFirstLevelGlossaryTermsPaginated as jest.Mock;

describe('GlossaryTermChildrenCountBadge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requests a status-filtered, count-only page of direct children', async () => {
    mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValueOnce({
      data: [],
      paging: { total: 2 },
    });

    await act(async () => {
      render(
        <GlossaryTermChildrenCountBadge
          isActive
          fqn="Test Glossary.Product Category"
        />
      );
    });

    expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalledWith(
      'Test Glossary.Product Category',
      0,
      undefined,
      'Approved,Draft,In Review'
    );
  });

  it('renders the filtered paging.total once the fetch resolves', async () => {
    mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValueOnce({
      data: [],
      paging: { total: 2 },
    });

    await act(async () => {
      render(
        <GlossaryTermChildrenCountBadge
          isActive
          fqn="Test Glossary.Product Category"
          initialCount={3}
        />
      );
    });

    expect(await screen.findByTestId('filter-count')).toHaveTextContent('2');
  });

  it('renders initialCount before the fetch resolves', () => {
    mockGetFirstLevelGlossaryTermsPaginated.mockReturnValue(
      new Promise(() => {})
    );

    render(
      <GlossaryTermChildrenCountBadge
        isActive
        fqn="Test Glossary.Product Category"
        initialCount={3}
      />
    );

    expect(screen.getByTestId('filter-count')).toHaveTextContent('3');
  });

  it('falls back to 0 when the fetch fails', async () => {
    mockGetFirstLevelGlossaryTermsPaginated.mockRejectedValueOnce(
      new Error('network error')
    );

    await act(async () => {
      render(
        <GlossaryTermChildrenCountBadge
          isActive
          fqn="Test Glossary.Product Category"
          initialCount={3}
        />
      );
    });

    expect(await screen.findByTestId('filter-count')).toHaveTextContent('0');
  });

  it('does not fetch when no fqn is provided', () => {
    render(<GlossaryTermChildrenCountBadge isActive initialCount={3} />);

    expect(mockGetFirstLevelGlossaryTermsPaginated).not.toHaveBeenCalled();
    expect(screen.getByTestId('filter-count')).toHaveTextContent('3');
  });
});
