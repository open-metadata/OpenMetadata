/*
 *  Copyright 2024 Collate.
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
import { MemoryRouter } from 'react-router-dom';
import { usePermissionProvider } from '../../../../../context/PermissionProvider/PermissionProvider';
import { mockIngestionData } from '../../../../../mocks/Ingestion.mock';
import {
  mockESIngestionData,
  mockIngestionListTableProps,
} from '../../../../../mocks/IngestionListTable.mock';
import { ENTITY_PERMISSIONS } from '../../../../../mocks/Permissions.mock';
import { deleteIngestionPipelineById } from '../../../../../rest/ingestionPipelineAPI';
import IngestionListTable from './IngestionListTable';

const mockGetEntityPermissionByFqn = jest.fn();

jest.mock('../../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(() => ({
    theme: { primaryColor: '#fff' },
  })),
}));

jest.mock(
  '../../../../../context/PermissionProvider/PermissionProvider',
  () => ({
    usePermissionProvider: jest.fn().mockImplementation(() => ({
      getEntityPermissionByFqn: jest
        .fn()
        .mockImplementation(() => Promise.resolve(ENTITY_PERMISSIONS)),
    })),
  })
);

jest.mock('../../../../../rest/ingestionPipelineAPI', () => ({
  deleteIngestionPipelineById: jest
    .fn()
    .mockImplementation(() => Promise.resolve()),
  getRunHistoryForPipeline: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: [] })),
}));

jest.mock('../../../../../utils/IngestionUtils', () => ({
  getErrorPlaceHolder: jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="error-placeholder">ErrorPlaceholder</div>
    )),
}));

jest.mock('./PipelineActions/PipelineActions', () =>
  jest.fn().mockImplementation(({ handleDeleteSelection }) => (
    <div>
      PipelineActions
      <button
        onClick={handleDeleteSelection({
          id: 'id',
          name: 'name',
          state: 'waiting',
        })}>
        handleDeleteSelection
      </button>
    </div>
  ))
);

jest.mock('../../../../Modals/EntityDeleteModal/EntityDeleteModal', () =>
  jest
    .fn()
    .mockImplementation(({ onConfirm }) => (
      <button onClick={onConfirm}>EntityDeleteModal</button>
    ))
);

jest.mock('./IngestionStatusCount/IngestionStatusCount', () =>
  jest.fn().mockImplementation(() => <div>IngestionStatusCount</div>)
);

jest.mock('../IngestionRecentRun/IngestionRecentRuns.component', () => ({
  IngestionRecentRuns: jest
    .fn()
    .mockImplementation(() => <div>IngestionRecentRuns</div>),
}));

jest.mock(
  '../../../../common/Skeleton/CommonSkeletons/ControlElements/ControlElements.component',
  () => jest.fn().mockImplementation(() => <div>ButtonSkeleton</div>)
);

jest.mock('../../../../common/RichTextEditor/RichTextEditorPreviewerV1', () =>
  jest.fn().mockImplementation(() => <div>RichTextEditorPreviewer</div>)
);

jest.mock('../../../../common/NextPrevious/NextPrevious', () =>
  jest.fn().mockImplementation(() => <div>NextPrevious</div>)
);

jest.mock('../../../../../utils/IngestionListTableUtils', () => ({
  renderNameField: jest
    .fn()
    .mockImplementation(() => () => <div>nameField</div>),
  renderScheduleField: jest
    .fn()
    .mockImplementation(() => <div>scheduleField</div>),
  renderStatusField: jest.fn().mockImplementation(() => <div>statusField</div>),
  renderTypeField: jest
    .fn()
    .mockImplementation(() => () => <div>typeField</div>),
}));

jest.mock('../../../../../utils/EntityUtils', () => ({
  ...jest.requireActual('../../../../../utils/EntityUtils'),
  highlightSearchText: jest.fn((text) => text),
}));

jest.mock('../../../../../utils/date-time/DateTimeUtils', () => ({
  getEpochMillisForPastDays: jest.fn().mockImplementation(() => 1),
  getCurrentMillis: jest.fn().mockImplementation(() => 1),
}));

describe('Ingestion', () => {
  it('should render custom emptyPlaceholder if passed', async () => {
    await act(async () => {
      render(
        <IngestionListTable
          {...mockIngestionListTableProps}
          emptyPlaceholder="customErrorPlaceholder"
          extraTableProps={{ scroll: undefined }}
          ingestionData={[]}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(screen.getByText('customErrorPlaceholder')).toBeInTheDocument();
  });

  it('should render default emptyPlaceholder if not passed customErrorPlaceholder', async () => {
    await act(async () => {
      render(
        <IngestionListTable
          {...mockIngestionListTableProps}
          extraTableProps={{ scroll: undefined }}
          ingestionData={[]}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(screen.getByText('ErrorPlaceholder')).toBeInTheDocument();
  });

  it('should not show the description column if showDescriptionCol is false', async () => {
    await act(async () => {
      render(
        <IngestionListTable
          {...mockIngestionListTableProps}
          showDescriptionCol={false}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(screen.queryByText('label.description')).toBeNull();
  });

  it('should show the description column if showDescriptionCol is true', async () => {
    await act(async () => {
      render(
        <IngestionListTable
          {...mockIngestionListTableProps}
          showDescriptionCol
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(screen.getByText('label.description')).toBeInTheDocument();
  });

  it('should replace the type column with custom type column if passed as prop', async () => {
    await act(async () => {
      render(
        <IngestionListTable
          {...mockIngestionListTableProps}
          pipelineTypeColumnObj={[]}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(screen.queryByText('label.type')).toBeNull();
  });

  it('should not show the actions column when enableActions is false', async () => {
    await act(async () => {
      render(
        <IngestionListTable
          {...mockIngestionListTableProps}
          enableActions={false}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(screen.queryByText('label.action-plural')).toBeNull();
  });

  it('should not show NextPrevious if ingestionPagingInfo is not present', async () => {
    await act(async () => {
      render(
        <IngestionListTable
          {...mockIngestionListTableProps}
          ingestionPagingInfo={undefined}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(screen.queryByText('NextPrevious')).toBeNull();
  });

  it('should not show NextPrevious if onPageChange is not present', async () => {
    await act(async () => {
      render(
        <IngestionListTable
          {...mockIngestionListTableProps}
          onPageChange={undefined}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(screen.queryByText('NextPrevious')).toBeNull();
  });

  it('should show NextPrevious if onPageChange and ingestionPagingInfo is present', async () => {
    await act(async () => {
      render(<IngestionListTable {...mockIngestionListTableProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.getByText('NextPrevious')).toBeInTheDocument();
  });

  it('should call deleteIngestionPipelineById on confirm click', async () => {
    await act(async () => {
      render(<IngestionListTable {...mockIngestionListTableProps} />, {
        wrapper: MemoryRouter,
      });
    });

    const deleteSelection = screen.getByText('handleDeleteSelection');

    await act(async () => {
      userEvent.click(deleteSelection);
    });

    const confirmButton = screen.getByText('EntityDeleteModal');

    fireEvent.click(confirmButton);

    expect(deleteIngestionPipelineById).toHaveBeenCalledWith('id');
  });

  it('should fetch the permissions for all the ingestion pipelines', async () => {
    (usePermissionProvider as jest.Mock).mockImplementation(() => ({
      getEntityPermissionByFqn: mockGetEntityPermissionByFqn,
    }));

    await act(async () => {
      render(
        <IngestionListTable
          {...mockIngestionListTableProps}
          ingestionData={[mockESIngestionData, mockIngestionData]}
        />,
        {
          wrapper: MemoryRouter,
        }
      );
    });

    expect(mockGetEntityPermissionByFqn).toHaveBeenNthCalledWith(
      1,
      'ingestionPipeline',
      mockESIngestionData.fullyQualifiedName
    );
    expect(mockGetEntityPermissionByFqn).toHaveBeenNthCalledWith(
      2,
      'ingestionPipeline',
      mockIngestionData.fullyQualifiedName
    );
  });
});
