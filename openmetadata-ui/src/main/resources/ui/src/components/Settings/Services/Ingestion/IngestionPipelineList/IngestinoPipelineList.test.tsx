/*
 *  Copyright 2023 Collate.
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
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { useAirflowStatus } from '../../../../../context/AirflowStatusProvider/AirflowStatusProvider';
import { ServiceCategory } from '../../../../../enums/service.enum';
import { mockIngestionData } from '../../../../../mocks/Ingestion.mock';
import { mockESIngestionData } from '../../../../../mocks/IngestionListTable.mock';
import {
  deployIngestionPipelineById,
  getIngestionPipelines,
} from '../../../../../rest/ingestionPipelineAPI';
import { IngestionPipelineList } from './IngestionPipelineList.component';

jest.mock('../../../../common/AirflowMessageBanner/AirflowMessageBanner', () =>
  jest
    .fn()
    .mockImplementation(({ unreachableFallbackMessage }) => (
      <p data-fallback={unreachableFallbackMessage}>AirflowMessageBanner</p>
    ))
);

jest.mock(
  '../../../../../context/AirflowStatusProvider/AirflowStatusProvider',
  () => ({
    useAirflowStatus: jest.fn().mockImplementation(() => ({
      isAirflowAvailable: true,
      isFetchingStatus: false,
    })),
  })
);

jest.mock('../IngestionListTable/IngestionListTable', () => {
  return jest
    .fn()
    .mockImplementation(({ extraTableProps, onPageChange, onSortChange }) => (
      <div>
        IngestionListTable
        <button
          onClick={() =>
            extraTableProps.rowSelection.onChange(
              [
                mockIngestionData.fullyQualifiedName,
                mockESIngestionData.fullyQualifiedName,
              ],
              [mockIngestionData, mockESIngestionData]
            )
          }>
          rowSelection
        </button>
        <button onClick={() => onSortChange('asc')}>sortAsc</button>
        <button onClick={() => onSortChange(undefined)}>sortClear</button>
        <button
          onClick={() => onPageChange({ cursorType: 'after', currentPage: 2 })}>
          nextPage
        </button>
      </div>
    ));
});

const AFTER_CURSOR = 'eyJkaXNwbGF5TmFtZVNvcnQiOiJBbHBoYSIsImlkIjoiaWQtMSJ9';

jest.mock('../../../../../rest/ingestionPipelineAPI', () => ({
  deployIngestionPipelineById: jest
    .fn()
    .mockImplementation(() => Promise.resolve()),
  getIngestionPipelines: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: [mockIngestionData, mockESIngestionData],
      paging: { total: 2, after: AFTER_CURSOR },
    })
  ),
}));

const mockLocationPathname = '/mock-path';

const setUrl = (search = '') =>
  globalThis.history.replaceState({}, '', `${mockLocationPathname}${search}`);

const renderList = async () => {
  await act(async () => {
    render(
      <BrowserRouter>
        <IngestionPipelineList
          serviceName={ServiceCategory.DASHBOARD_SERVICES}
        />
      </BrowserRouter>
    );
  });
};

const lastRequest = () =>
  (getIngestionPipelines as jest.Mock).mock.calls.at(-1)?.[0];

describe('IngestionPipelineList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setUrl();
    (useAirflowStatus as jest.Mock).mockImplementation(() => ({
      isAirflowAvailable: true,
      isFetchingStatus: false,
    }));
  });

  it.each([
    [
      'is still being fetched',
      { isAirflowAvailable: false, isFetchingStatus: true },
    ],
    [
      'reports it unavailable',
      { isAirflowAvailable: false, isFetchingStatus: false },
    ],
  ])(
    'should list the pipelines while the airflow status %s',
    async (_label, status) => {
      (useAirflowStatus as jest.Mock).mockImplementation(() => status);

      await renderList();

      expect(screen.getByText('IngestionListTable')).toBeInTheDocument();
      expect(getIngestionPipelines).toHaveBeenCalled();
    }
  );

  it('should disable the bulk re-deploy button when the pipeline service is unreachable', async () => {
    (useAirflowStatus as jest.Mock).mockImplementation(() => ({
      isAirflowAvailable: false,
      isFetchingStatus: false,
    }));

    await renderList();

    fireEvent.click(screen.getByText('rowSelection'));

    expect(screen.getByTestId('bulk-re-deploy-button')).toBeDisabled();
    // The fallback is opt-in — without it a thrown status call leaves the disabled button
    // unexplained.
    expect(screen.getByText('AirflowMessageBanner')).toHaveAttribute(
      'data-fallback',
      'message.pipeline-service-unreachable-agent-actions'
    );
  });

  it('should not call deployIngestionPipelineById after bulk deploy button click without pipeline selection', async () => {
    await renderList();

    const bulkDeployButton = screen.getByTestId('bulk-re-deploy-button');

    await act(async () => {
      userEvent.click(bulkDeployButton);
    });

    expect(deployIngestionPipelineById).not.toHaveBeenCalled();
  });

  it('should call deployIngestionPipelineById after bulk deploy button click after pipeline selection', async () => {
    await renderList();

    const rowSelection = screen.getByText('rowSelection');

    fireEvent.click(rowSelection);

    const bulkDeployButton = screen.getByTestId('bulk-re-deploy-button');

    fireEvent.click(bulkDeployButton);

    expect(deployIngestionPipelineById).toHaveBeenCalledTimes(2);
  });

  describe('sort order', () => {
    it('should send the sort order the URL was restored with alongside the cursor', async () => {
      // A reload of a sorted page 2. The cursor is a (displayNameSort, id) tuple, so dropping
      // sortField on restore sends it down the default name-ordered path, which matches no row
      // and silently renders an empty page.
      setUrl(
        `?cursorType=after&cursorValue=${AFTER_CURSOR}&currentPage=2&sortOrder=desc`
      );

      await renderList();

      expect(lastRequest()).toEqual(
        expect.objectContaining({
          paging: { after: AFTER_CURSOR },
          sortField: 'displayName',
          sortOrder: 'desc',
        })
      );
    });

    it('should persist the sort order to the URL and drop the stale cursor', async () => {
      setUrl();
      await renderList();

      await act(async () => {
        fireEvent.click(screen.getByText('nextPage'));
      });

      expect(globalThis.location.search).toContain('cursorValue');

      (getIngestionPipelines as jest.Mock).mockClear();

      await act(async () => {
        fireEvent.click(screen.getByText('sortAsc'));
      });

      expect(globalThis.location.search).toContain('sortOrder=asc');
      expect(globalThis.location.search).not.toContain('cursorValue');
      // One state change, one request — an intermediate render carrying the new sort with the
      // stale cursor would both 400 and race the correct request.
      expect(getIngestionPipelines).toHaveBeenCalledTimes(1);
      expect(lastRequest()).toEqual(
        expect.objectContaining({
          paging: undefined,
          sortField: 'displayName',
          sortOrder: 'asc',
        })
      );
    });

    it('should clear the sort order from the URL when sorting is removed', async () => {
      setUrl('?sortOrder=asc');
      await renderList();

      await act(async () => {
        fireEvent.click(screen.getByText('sortClear'));
      });

      expect(globalThis.location.search).not.toContain('sortOrder');
      expect(lastRequest()).not.toHaveProperty('sortField');
    });

    it('should ignore an unsupported sort order in the URL', async () => {
      // The endpoint rejects anything other than asc/desc, so a hand-edited URL must fall back to
      // the unsorted listing rather than sending the value straight through.
      setUrl('?sortOrder=sideways');

      await renderList();

      expect(lastRequest()).not.toHaveProperty('sortField');
      expect(lastRequest()).not.toHaveProperty('sortOrder');
    });
  });
});
