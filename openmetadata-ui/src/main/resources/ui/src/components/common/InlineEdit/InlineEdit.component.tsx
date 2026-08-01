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
import { Space } from 'antd';
import { Button } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import './inline-edit.less';
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
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel?.();
    }
  };

  return (
    <Space
      className={classNames(className, 'inline-edit-container')}
      data-testid="inline-edit-container"
      direction={direction}
      // Used onClick to stop click propagation event anywhere in the component to parent
      // TeamDetailsV1 and User.component collapsible panel.
      onClick={(e) => e.stopPropagation()}
      onKeyDown={handleKeyDown}>
      {children}
      <Space className="w-full justify-end" data-testid="buttons" size={4}>
        <Button
          data-testid="inline-cancel-btn"
          onClick={onCancel}
          {...cancelButtonProps}
          color="primary"
          iconLeading={<CloseOutlined />}
          isDisabled={isLoading}
          size="xs"
        />
        <Button
          data-testid="inline-save-btn"
          onClick={onSave}
          {...saveButtonProps}
          color="primary"
          iconLeading={<CheckOutlined />}
          isLoading={isLoading}
          size="xs"
        />
      </Space>
    </Space>
  );
};

export default InlineEdit;
