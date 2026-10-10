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
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Table } from '../../../generated/entity/data/table';
import { MOCK_TABLE } from '../../../mocks/TableData.mock';
import CustomMetricForm from './CustomMetricForm.component';

jest.mock('../../../hooks/useCustomLocation/useCustomLocation', () => {
  return jest.fn().mockImplementation(() => ({
    search:
      '?activeColumnFqn=sample_data.ecommerce_db.shopify.dim_address.address_id',
  }));
});

describe('CustomMetricForm', () => {
  it('component should render', async () => {
    render(<CustomMetricForm isColumnMetric={false} onFinish={jest.fn()} />);

    expect(await screen.findByTestId('custom-metric-form')).toBeInTheDocument();
    expect(await screen.findByTestId('custom-metric-name')).toBeInTheDocument();
    expect(
      await screen.findByTestId('sql-editor-container')
    ).toBeInTheDocument();
  });

  it('should render column when isColumnMetric is true', async () => {
    render(<CustomMetricForm isColumnMetric onFinish={jest.fn()} />);

    expect(
      await screen.findByTestId('custom-metric-column')
    ).toBeInTheDocument();
  });

  it('if isEditMode is true, name and column should be disabled', async () => {
    render(<CustomMetricForm isColumnMetric isEditMode onFinish={jest.fn()} />);

    expect(await screen.findByTestId('custom-metric-name')).toBeDisabled();
    expect(
      within(await screen.findByTestId('custom-metric-column')).getByRole(
        'button'
      )
    ).toBeDisabled();
  });

  it('initial value is visible if provided', async () => {
    const initialValues = {
      name: 'custom metric',
      expression: 'select * from table',
      columnName: 'column',
    };
    render(
      <CustomMetricForm
        isColumnMetric
        isEditMode
        initialValues={initialValues}
        table={{ columns: [{ name: 'column' }] } as Table}
        onFinish={jest.fn()}
      />
    );

    expect(await screen.findByTestId('custom-metric-name')).toHaveValue(
      initialValues.name
    );
    expect(
      within(await screen.findByTestId('custom-metric-column')).getByRole(
        'button'
      )
    ).toHaveTextContent(initialValues.columnName);
    // The line-number and fold gutters live inside the container, so read the
    // expression from the editor's content element instead of the whole box.
    expect(
      within(await screen.findByTestId('code-mirror-container')).getByRole(
        'textbox'
      )
    ).toHaveTextContent(initialValues.expression);
  });

  it('blocks empty name and SQL fields without submitting', async () => {
    const onFinish = jest.fn();
    render(<CustomMetricForm isColumnMetric={false} onFinish={onFinish} />);
    const form = await screen.findByTestId('custom-metric-form');
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(onFinish).not.toHaveBeenCalled();
    expect(screen.getByText('label.field-required')).toBeVisible();
    expect(screen.getByText('message.field-text-is-required')).toBeVisible();
  });

  it('submits edited values while keeping the disabled metric name', async () => {
    const onFinish = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <CustomMetricForm
        isEditMode
        initialValues={{
          name: 'row_metric',
          expression: 'SELECT COUNT(*) FROM table_name',
          id: 'persisted-id',
          description: 'not a form field',
        }}
        isColumnMetric={false}
        onFinish={onFinish}
      />
    );
    const editor = within(
      await screen.findByTestId('code-mirror-container')
    ).getByRole('textbox');
    await user.click(editor);
    await user.keyboard('{Control>}a{/Control}SELECT 10');
    await act(async () => {
      fireEvent.submit(screen.getByTestId('custom-metric-form'));
    });

    expect(onFinish).toHaveBeenCalledWith({
      name: 'row_metric',
      expression: 'SELECT 10',
    });
  });

  it('rejects an existing table metric name before submitting', async () => {
    const onFinish = jest.fn();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <CustomMetricForm
        initialValues={{ expression: 'SELECT 1' }}
        isColumnMetric={false}
        table={{
          ...MOCK_TABLE,
          columns: [],
          customMetrics: [{ name: 'duplicate', expression: 'SELECT 1' }],
        }}
        onFinish={onFinish}
      />
    );
    await user.type(
      await screen.findByTestId('custom-metric-name'),
      'duplicate'
    );
    await act(async () => {
      fireEvent.submit(screen.getByTestId('custom-metric-form'));
    });

    expect(screen.getByText('message.entity-already-exists')).toBeVisible();
    expect(onFinish).not.toHaveBeenCalled();
  });
});
