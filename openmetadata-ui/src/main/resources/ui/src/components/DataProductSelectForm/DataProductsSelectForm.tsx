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
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { Button, Col, Row, Space } from 'antd';
import React, { useRef, useState } from 'react';
import { DataProductsSelectRef } from '../../components/DataProductsSelectList/DataProductSelectList.interface';
import DataProductsSelectList from '../../components/DataProductsSelectList/DataProductsSelectList';
import { DataProductsSelectFormProps } from './DataProductsSelectForm.interface';

const DataProductsSelectForm = ({
  fetchApi,
  defaultValue,
  placeholder,
  onSubmit,
  onCancel,
}: DataProductsSelectFormProps) => {
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const selectRef = useRef<DataProductsSelectRef>(null);

  const onSave = () => {
    setIsSubmitLoading(true);
    const value = selectRef.current?.getSelectValue() ?? [];
    onSubmit(value);
  };

  return (
    <Row gutter={[0, 8]}>
      <Col className="gutter-row d-flex justify-end" span={24}>
        <Space align="center">
          <Button
            className="p-x-05"
            data-testid="cancelAssociatedTag"
            disabled={isSubmitLoading}
            icon={<CloseOutlined size={12} />}
            size="small"
            onClick={onCancel}
          />
          <Button
            className="p-x-05"
            data-testid="saveAssociatedTag"
            icon={<CheckOutlined size={12} />}
            loading={isSubmitLoading}
            size="small"
            type="primary"
            onClick={onSave}
          />
        </Space>
      </Col>

      <Col className="gutter-row" span={24}>
        <DataProductsSelectList
          defaultValue={defaultValue}
          fetchOptions={fetchApi}
          mode="multiple"
          placeholder={placeholder}
          ref={selectRef}
        />
      </Col>
    </Row>
  );
};

export default DataProductsSelectForm;
