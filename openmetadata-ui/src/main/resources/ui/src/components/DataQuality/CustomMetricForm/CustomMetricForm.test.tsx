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
import { render, screen } from '@testing-library/react';
import { Form } from 'antd';
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
    expect(await screen.findByTestId('custom-metric-column')).toHaveClass(
      'ant-select-disabled'
    );
  });

  it('initial value is visible if provided', async () => {
    const initialValues = {
      name: 'custom metric',
      expression: 'select * from table',
      columnName: 'column',
    };
    const FormWrapper = () => {
      const [form] = Form.useForm();

      return (
        <CustomMetricForm
          isColumnMetric
          isEditMode
          form={form}
          initialValues={initialValues}
          onFinish={jest.fn()}
        />
      );
    };

    render(<FormWrapper />);

    expect(await screen.findByTestId('custom-metric-name')).toHaveValue(
      initialValues.name
    );
    expect(
      await screen.findByText(initialValues.columnName)
    ).toBeInTheDocument();
    expect(
      (await screen.findByTestId('code-mirror-container')).textContent
    ).toEqual(initialValues.expression);
  });
});
