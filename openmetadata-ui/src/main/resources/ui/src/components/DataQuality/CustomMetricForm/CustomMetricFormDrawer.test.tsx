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
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Table } from '../../../generated/entity/data/table';
import { MOCK_TABLE } from '../../../mocks/TableData.mock';
import { putCustomMetric } from '../../../rest/customMetricAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import CustomMetricFormDrawer from './CustomMetricFormDrawer';

const mockLocation = { search: '' };
const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('../../../hooks/useCustomLocation/useCustomLocation', () =>
  jest.fn(() => mockLocation)
);

jest.mock('../../../rest/customMetricAPI', () => ({
  putCustomMetric: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock(
  '../../Database/Profiler/TableProfiler/TableProfilerChart/TableProfilerChart',
  () =>
    jest.fn(({ entityFqn }: { entityFqn: string }) => (
      <div data-testid="table-profile-preview">{entityFqn}</div>
    ))
);

jest.mock('../../Database/Profiler/TableProfiler/SingleColumnProfile', () =>
  jest.fn(({ activeColumnFqn }: { activeColumnFqn: string }) => (
    <div data-testid="column-profile-preview">{activeColumnFqn}</div>
  ))
);

const TABLE = {
  ...MOCK_TABLE,
  customMetrics: [{ name: 'existing_metric', expression: 'SELECT 1' }],
} as Table;
const [FIRST_COLUMN, SECOND_COLUMN] = TABLE.columns;

const typeQuery = async (
  user: ReturnType<typeof userEvent.setup>,
  query: string
) => {
  const editor = within(
    await screen.findByTestId('code-mirror-container')
  ).getByRole('textbox');
  await user.click(editor);
  await user.keyboard(`{Control>}a{/Control}${query}`);
};

describe('CustomMetricFormDrawer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.search = '';
  });

  it('creates a table metric, refreshes the host and closes', async () => {
    const updatedTable = { ...TABLE, customMetrics: [] } as Table;
    (putCustomMetric as jest.Mock).mockResolvedValue({ data: updatedTable });
    const onClose = jest.fn();
    const onSuccess = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <CustomMetricFormDrawer
        open
        isColumnMetric={false}
        table={TABLE}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    expect(await screen.findByText('label.add-entity-metric')).toBeVisible();
    expect(screen.getByTestId('table-profile-preview')).toHaveTextContent(
      TABLE.fullyQualifiedName ?? ''
    );

    await user.type(screen.getByTestId('custom-metric-name'), 'row_metric');
    await typeQuery(user, 'SELECT 10');
    await user.click(screen.getByTestId('submit-button'));

    await waitFor(() =>
      expect(putCustomMetric).toHaveBeenCalledWith(TABLE.id, {
        name: 'row_metric',
        expression: 'SELECT 10',
      })
    );

    expect(showSuccessToast).toHaveBeenCalledWith(
      'server.create-entity-success'
    );
    expect(onSuccess).toHaveBeenCalledWith(updatedTable);

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('preselects the active profiler column and previews the selected column', async () => {
    mockLocation.search = `?activeColumnFqn=${SECOND_COLUMN.fullyQualifiedName}`;
    render(
      <CustomMetricFormDrawer
        isColumnMetric
        open
        table={TABLE}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    );

    expect(
      within(await screen.findByTestId('custom-metric-column')).getByRole(
        'button'
      )
    ).toHaveTextContent(SECOND_COLUMN.name);
    expect(screen.getByTestId('column-profile-preview')).toHaveTextContent(
      SECOND_COLUMN.fullyQualifiedName ?? ''
    );
  });

  it("opens the new column metric's column profile after creating it", async () => {
    mockLocation.search = '?startTs=1&endTs=2';
    (putCustomMetric as jest.Mock).mockResolvedValue({ data: TABLE });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <CustomMetricFormDrawer
        isColumnMetric
        open
        table={TABLE}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    );

    await user.type(
      await screen.findByTestId('custom-metric-name'),
      'column_metric'
    );
    await user.click(
      within(screen.getByTestId('custom-metric-column')).getByRole('button')
    );
    await user.click(
      await screen.findByRole('option', { name: SECOND_COLUMN.name })
    );
    await typeQuery(user, 'SELECT 1');
    await user.click(screen.getByTestId('submit-button'));

    await waitFor(() =>
      expect(putCustomMetric).toHaveBeenCalledWith(TABLE.id, {
        name: 'column_metric',
        expression: 'SELECT 1',
        columnName: SECOND_COLUMN.name,
      })
    );

    expect(mockNavigate).toHaveBeenCalledWith({
      search: `startTs=1&endTs=2&activeColumnFqn=${encodeURIComponent(
        SECOND_COLUMN.fullyQualifiedName ?? ''
      )}`,
    });
  });

  it('edits a column metric, keeping its persisted fields but not its id', async () => {
    (putCustomMetric as jest.Mock).mockResolvedValue({ data: TABLE });
    const metric = {
      id: 'metric-id',
      name: 'column_metric',
      expression: 'SELECT 1',
      columnName: FIRST_COLUMN.name,
      description: 'kept on update',
    };
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <CustomMetricFormDrawer
        isColumnMetric
        open
        metric={metric}
        table={TABLE}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    );

    expect(await screen.findByText('label.edit-entity')).toBeVisible();
    expect(screen.getByTestId('custom-metric-name')).toHaveValue(metric.name);
    expect(screen.getByTestId('custom-metric-name')).toBeDisabled();

    await typeQuery(user, 'SELECT 2');
    await user.click(screen.getByTestId('submit-button'));

    await waitFor(() =>
      expect(putCustomMetric).toHaveBeenCalledWith(TABLE.id, {
        name: metric.name,
        expression: 'SELECT 2',
        columnName: FIRST_COLUMN.name,
        description: metric.description,
      })
    );

    expect(showSuccessToast).toHaveBeenCalledWith(
      'server.update-entity-success'
    );
  });

  it('keeps the drawer open when saving fails', async () => {
    const error = new Error('boom');
    (putCustomMetric as jest.Mock).mockRejectedValue(error);
    const onClose = jest.fn();
    const onSuccess = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <CustomMetricFormDrawer
        open
        isColumnMetric={false}
        table={TABLE}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    );

    await user.type(
      await screen.findByTestId('custom-metric-name'),
      'row_metric'
    );
    await typeQuery(user, 'SELECT 10');
    await user.click(screen.getByTestId('submit-button'));

    await waitFor(() => expect(showErrorToast).toHaveBeenCalledWith(error));

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('custom-metric-form')).toBeInTheDocument();
  });

  it('hides the profile preview and narrows the drawer with the Show Hint toggle', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <CustomMetricFormDrawer
        open
        isColumnMetric={false}
        table={TABLE}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    );

    const toggle = await screen.findByTestId('show-hint-toggle');
    // The drawer caps its panel at the given width; the form sits in a Grid column.
    const drawerPanel = () => screen.getByRole('dialog').parentElement;
    const formColumn = () =>
      screen.getByTestId('custom-metric-form').parentElement;

    expect(
      screen.getByTestId('custom-metric-profile-preview')
    ).toBeInTheDocument();
    expect(drawerPanel()).toHaveStyle({ maxWidth: '80vw' });
    expect(formColumn()).toHaveStyle({ gridColumn: 'span 14' });

    await user.click(toggle);

    expect(
      screen.queryByTestId('custom-metric-profile-preview')
    ).not.toBeInTheDocument();
    expect(drawerPanel()).toHaveStyle({ maxWidth: '60vw' });
    expect(formColumn()).toHaveStyle({ gridColumn: 'span 24' });

    await user.click(toggle);

    expect(
      screen.getByTestId('custom-metric-profile-preview')
    ).toBeInTheDocument();
    expect(drawerPanel()).toHaveStyle({ maxWidth: '80vw' });
    expect(formColumn()).toHaveStyle({ gridColumn: 'span 14' });
  });

  it('rejects a name already used by a table metric', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <CustomMetricFormDrawer
        open
        isColumnMetric={false}
        table={TABLE}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />
    );

    await user.type(
      await screen.findByTestId('custom-metric-name'),
      'existing_metric'
    );
    await typeQuery(user, 'SELECT 10');
    await user.click(screen.getByTestId('submit-button'));

    expect(
      await screen.findByText('message.entity-already-exists')
    ).toBeVisible();
    expect(putCustomMetric).not.toHaveBeenCalled();
  });
});
