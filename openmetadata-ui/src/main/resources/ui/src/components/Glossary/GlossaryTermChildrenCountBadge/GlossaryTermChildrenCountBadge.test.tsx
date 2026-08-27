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
import { useGlossaryStore } from '../useGlossary.store';
import GlossaryTermChildrenCountBadge from './GlossaryTermChildrenCountBadge.component';

jest.mock('../../../rest/glossaryAPI', () => ({
  getFirstLevelGlossaryTermsPaginated: jest.fn(),
}));

const mockGetFirstLevelGlossaryTermsPaginated =
  getFirstLevelGlossaryTermsPaginated as jest.Mock;

describe('GlossaryTermChildrenCountBadge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useGlossaryStore.setState({ termsStatusFilter: undefined } as never);
  });

  it('requests a status-filtered, count-only page of direct children', async () => {
    useGlossaryStore.setState({
      termsStatusFilter: 'Approved,Draft,In Review',
    } as never);
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
    useGlossaryStore.setState({
      termsStatusFilter: 'Approved,Draft,In Review',
    } as never);
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

  it('re-fetches when refreshTrigger changes, e.g. after a term is added', async () => {
    mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValueOnce({
      data: [],
      paging: { total: 2 },
    });

    let renderResult: ReturnType<typeof render>;
    await act(async () => {
      renderResult = render(
        <GlossaryTermChildrenCountBadge
          isActive
          fqn="Test Glossary.Product Category"
          refreshTrigger={0}
        />
      );
    });

    expect(await screen.findByTestId('filter-count')).toHaveTextContent('2');
    expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalledTimes(1);

    mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValueOnce({
      data: [],
      paging: { total: 3 },
    });

    await act(async () => {
      renderResult.rerender(
        <GlossaryTermChildrenCountBadge
          isActive
          fqn="Test Glossary.Product Category"
          refreshTrigger={1}
        />
      );
    });

    expect(await screen.findByTestId('filter-count')).toHaveTextContent('3');
    expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalledTimes(2);
  });

  it('does not re-fetch when re-rendered with the same refreshTrigger', async () => {
    mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValueOnce({
      data: [],
      paging: { total: 2 },
    });

    let renderResult: ReturnType<typeof render>;
    await act(async () => {
      renderResult = render(
        <GlossaryTermChildrenCountBadge
          isActive
          fqn="Test Glossary.Product Category"
          refreshTrigger={0}
        />
      );
    });

    await act(async () => {
      renderResult.rerender(
        <GlossaryTermChildrenCountBadge
          isActive
          fqn="Test Glossary.Product Category"
          refreshTrigger={0}
        />
      );
    });

    expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalledTimes(1);
  });

  it('uses the live termsStatusFilter from useGlossaryStore when set', async () => {
    useGlossaryStore.setState({
      termsStatusFilter: 'Approved,Draft,In Review,Rejected',
    } as never);
    mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValueOnce({
      data: [],
      paging: { total: 1 },
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
      'Approved,Draft,In Review,Rejected'
    );
  });

  // useGlossary.store seeds termsStatusFilter with the default filter string, so
  // a genuinely undefined termsStatusFilter here only happens once the table has
  // mounted and the user explicitly selected "All" statuses and saved — it must
  // NOT be defaulted, since that would silently re-apply a filter the user just
  // turned off and disagree with what the (now unfiltered) table shows.
  it('sends no entityStatus filter when termsStatusFilter is undefined (user selected All statuses)', async () => {
    useGlossaryStore.setState({ termsStatusFilter: undefined } as never);
    mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValueOnce({
      data: [],
      paging: { total: 9 },
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
      undefined
    );
    expect(await screen.findByTestId('filter-count')).toHaveTextContent('9');
  });

  it('re-fetches when termsStatusFilter changes, e.g. after the table status filter is saved', async () => {
    useGlossaryStore.setState({
      termsStatusFilter: 'Approved,Draft,In Review',
    } as never);
    mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValueOnce({
      data: [],
      paging: { total: 3 },
    });

    let renderResult: ReturnType<typeof render>;
    await act(async () => {
      renderResult = render(
        <GlossaryTermChildrenCountBadge
          isActive
          fqn="Test Glossary.Product Category"
        />
      );
    });

    expect(await screen.findByTestId('filter-count')).toHaveTextContent('3');
    expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalledTimes(1);

    mockGetFirstLevelGlossaryTermsPaginated.mockResolvedValueOnce({
      data: [],
      paging: { total: 7 },
    });

    await act(async () => {
      useGlossaryStore.setState({ termsStatusFilter: 'Approved' } as never);
      renderResult.rerender(
        <GlossaryTermChildrenCountBadge
          isActive
          fqn="Test Glossary.Product Category"
        />
      );
    });

    expect(await screen.findByTestId('filter-count')).toHaveTextContent('7');
    expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenLastCalledWith(
      'Test Glossary.Product Category',
      0,
      undefined,
      'Approved'
    );
    expect(mockGetFirstLevelGlossaryTermsPaginated).toHaveBeenCalledTimes(2);
  });
});
