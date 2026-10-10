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
import { Check, XClose } from '@openmetadata/ui-core-components/icons';
import { Box, Grid } from '@openmetadata/ui-core-components';
import { Button, Form, Select } from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { useState } from 'react';
import { DomainType } from '../../../generated/api/domains/createDomain';
import { getLayoutGutter } from '../../../utils/common/layout.utils';
import { DomainTypeSelectFormProps } from './DomainTypeSelectForm.interface';

const DomainTypeSelectForm = ({
  defaultValue,
  onSubmit,
  onCancel,
}: DomainTypeSelectFormProps) => {
  const [form] = useForm();
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const domainTypeArray = Object.keys(DomainType).map((key) => ({
    key,
    value: DomainType[key as keyof typeof DomainType],
  }));

  return (
    <Form
      form={form}
      initialValues={{ domainType: defaultValue }}
      name="domainTypeForm"
      onFinish={(data) => {
        setIsSubmitLoading(true);
        onSubmit(data.domainType);
      }}>
      <Grid
        className="layout-row layout-grid"
        style={{ ...getLayoutGutter(0, 8) }}>
        <Grid.Item
          className="layout-column gutter-row d-flex justify-end"
          span={24}>
          <Box
            inline
            align="center"
            className="layout-space layout-space-horizontal"
            gap={2}
            itemClassName="layout-space-item">
            <Button
              className="p-x-05"
              data-testid="cancelAssociatedTag"
              disabled={isSubmitLoading}
              icon={<XClose size={12} />}
              size="small"
              onClick={onCancel}
            />
            <Button
              className="p-x-05"
              data-testid="saveAssociatedTag"
              htmlType="submit"
              icon={<Check size={12} />}
              loading={isSubmitLoading}
              size="small"
              type="primary"
            />
          </Box>
        </Grid.Item>

        <Grid.Item className="layout-column gutter-row" span={24}>
          <Form.Item noStyle name="domainType">
            <Select
              className="w-full"
              data-testid="domainType-select"
              options={domainTypeArray}
            />
          </Form.Item>
        </Grid.Item>
      </Grid>
    </Form>
  );
};

export default DomainTypeSelectForm;
