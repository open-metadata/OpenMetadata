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
import { Drawer, DrawerProps, Form } from 'antd';
import { useForm } from 'antd/lib/form/Form';
import classNames from 'classnames';
import { FC, useEffect } from 'react';
import { ReactComponent as ColumnIcon } from '../../../../assets/svg/ic-column.svg';
import { ReactComponent as TableIcon } from '../../../../assets/svg/ic-format-table.svg';
import SelectionCardGroup from '../../../common/SelectionCardGroup/SelectionCardGroup';
import { SelectionOption } from '../../../common/SelectionCardGroup/SelectionCardGroup.interface';
import './TestCaseFormV1.less';

export interface TestCaseFormV1Props {
  isDrawer?: boolean;
  drawerProps?: DrawerProps;
  className?: string;
  onFormSubmit?: (values: FormValues) => void;
  initialValues?: Partial<FormValues>;
}

interface FormValues {
  testLevel: TestLevel;
}

export enum TestLevel {
  TABLE = 'table',
  COLUMN = 'column',
}

const TEST_LEVEL_OPTIONS: SelectionOption[] = [
  {
    value: 'table',
    label: 'Table Level',
    description: 'Test applied on table',
    icon: <TableIcon />,
  },
  {
    value: 'column',
    label: 'Column Level',
    description: 'Test applied on column',
    icon: <ColumnIcon />,
  },
];

const TestCaseFormV1: FC<TestCaseFormV1Props> = ({
  className,
  drawerProps,
  initialValues,
  isDrawer = false,
  onFormSubmit,
}) => {
  const [form] = useForm<FormValues>();

  const handleSubmit = (values: FormValues) => {
    onFormSubmit?.(values);
  };

  useEffect(() => {
    form.setFieldsValue({ testLevel: TestLevel.TABLE });
  }, [form]);

  const formContent = (
    <div
      className={classNames(
        'test-case-form-v1',
        {
          'drawer-mode': isDrawer,
          'standalone-mode': !isDrawer,
        },
        className
      )}>
      <Form
        form={form}
        initialValues={initialValues}
        layout="vertical"
        onFinish={handleSubmit}>
        <Form.Item
          label="Select on which element your test should be performed"
          name="testLevel"
          rules={[{ required: true, message: 'Please select test level' }]}>
          <SelectionCardGroup options={TEST_LEVEL_OPTIONS} />
        </Form.Item>
      </Form>
    </div>
  );

  if (isDrawer) {
    return (
      <Drawer
        destroyOnClose
        open
        placement="right"
        size="large"
        {...drawerProps}>
        {formContent}
      </Drawer>
    );
  }

  return formContent;
};

export default TestCaseFormV1;
