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
import { act, render, screen, waitFor } from '@testing-library/react';
import { getRdfReindexFailures } from '../../../../rest/rdfAPI';
import { getReindexFailures } from '../../../../rest/searchAPI';
import ReindexFailures from './ReindexFailures.component';

jest.mock('../../../../rest/searchAPI', () => ({
  getReindexFailures: jest.fn().mockResolvedValue({
    data: [
      {
        id: 'search-1',
        entityType: 'table',
        entityId: 'abc',
        failureStage: 'SINK',
        errorMessage: 'search failure',
        timestamp: 1,
      },
    ],
    total: 1,
    offset: 0,
    limit: 20,
  }),
}));

jest.mock('../../../../rest/rdfAPI', () => ({
  getRdfReindexFailures: jest.fn().mockResolvedValue({
    data: [
      {
        id: 'rdf-1',
        entityType: 'dashboard',
        entityId: 'xyz',
        failureStage: 'ENTITY_WRITE',
        errorMessage: 'rdf failure',
        timestamp: 2,
      },
    ],
    total: 1,
    offset: 0,
    limit: 20,
  }),
}));

jest.mock('../../../../utils/date-time/DateTimeUtils', () => ({
  formatDateTimeWithTimezone: jest.fn().mockReturnValue('timestamp'),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

describe('ReindexFailures', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should read RDF failures when opened for the RDF indexing app', async () => {
    await act(async () => {
      render(
        <ReindexFailures visible appName="RdfIndexApp" onClose={jest.fn()} />
      );
    });

    expect(getRdfReindexFailures).toHaveBeenCalledTimes(1);
    expect(getReindexFailures).not.toHaveBeenCalled();
    expect(await screen.findByText('rdf failure')).toBeInTheDocument();
  });

  it('should read search failures for the search indexing app', async () => {
    await act(async () => {
      render(
        <ReindexFailures
          visible
          appName="SearchIndexingApplication"
          onClose={jest.fn()}
        />
      );
    });

    expect(getReindexFailures).toHaveBeenCalledTimes(1);
    expect(getRdfReindexFailures).not.toHaveBeenCalled();
    expect(await screen.findByText('search failure')).toBeInTheDocument();
  });

  it('should default to search failures when no app name is provided', async () => {
    await act(async () => {
      render(<ReindexFailures visible onClose={jest.fn()} />);
    });

    expect(getReindexFailures).toHaveBeenCalledTimes(1);
    expect(getRdfReindexFailures).not.toHaveBeenCalled();
  });

  it('should ignore a stale response when the app changes while open', async () => {
    type FailureResponse = {
      data: Array<Record<string, unknown>>;
      total: number;
      offset: number;
      limit: number;
    };
    let resolveRdfRequest: (response: FailureResponse) => void = jest.fn();
    (getRdfReindexFailures as jest.Mock).mockImplementationOnce(
      () =>
        new Promise<FailureResponse>((resolve) => {
          resolveRdfRequest = resolve;
        })
    );
    const { rerender } = render(
      <ReindexFailures visible appName="RdfIndexApp" onClose={jest.fn()} />
    );
    await waitFor(() => expect(getRdfReindexFailures).toHaveBeenCalledTimes(1));

    rerender(
      <ReindexFailures
        visible
        appName="SearchIndexingApplication"
        onClose={jest.fn()}
      />
    );

    expect(await screen.findByText('search failure')).toBeInTheDocument();

    await act(async () => {
      resolveRdfRequest({
        data: [
          {
            id: 'stale-rdf',
            entityType: 'dashboard',
            entityId: 'stale',
            failureStage: 'ENTITY_WRITE',
            errorMessage: 'stale rdf failure',
            timestamp: 3,
          },
        ],
        total: 1,
        offset: 0,
        limit: 20,
      });
    });

    expect(screen.queryByText('stale rdf failure')).not.toBeInTheDocument();
    expect(screen.getByText('search failure')).toBeInTheDocument();
    expect(getRdfReindexFailures).toHaveBeenCalledTimes(1);
    expect(getReindexFailures).toHaveBeenCalledTimes(1);
  });

  it('should not fetch anything while the drawer is closed', async () => {
    await act(async () => {
      render(
        <ReindexFailures
          appName="RdfIndexApp"
          visible={false}
          onClose={jest.fn()}
        />
      );
    });

    expect(getRdfReindexFailures).not.toHaveBeenCalled();
    expect(getReindexFailures).not.toHaveBeenCalled();
  });
});
