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
import { Button, Space } from 'antd';
import classNames from 'classnames';
import React from 'react';
import { InlineEditProps } from './InlineEdit.interface';

const InlineEdit = ({
  children,
  onCancel,
  onSave,
  direction,
  className,
  isLoading,
  cancelButtonProps,
  saveButtonProps,
}: InlineEditProps) => {
  return (
    <Space
      className={classNames(className, 'w-full')}
      data-testid="inline-edit-container"
      direction={direction}>
      {children}

      <Space className="w-full justify-end" data-testid="buttons" size={4}>
        <Button
          data-testid="inline-cancel-btn"
          disabled={isLoading}
          icon={<CloseOutlined />}
          size="small"
          type="primary"
          onClick={onCancel}
          {...cancelButtonProps}
        />
        <Button
          data-testid="inline-save-btn"
          icon={<CheckOutlined />}
          loading={isLoading}
          size="small"
          type="primary"
          onClick={onSave}
          {...saveButtonProps}
        />
      </Space>
    </Space>
  );
};

export default InlineEdit;
