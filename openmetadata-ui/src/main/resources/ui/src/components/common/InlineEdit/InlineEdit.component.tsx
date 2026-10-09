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
import { Box } from '@openmetadata/ui-core-components';
import { Button } from 'antd';
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

  // Editing actions must not toggle the parent user/team collapsible panel.
  return (
    <Box
      inline
      align={direction === 'vertical' ? 'stretch' : 'center'}
      className={`layout-space ${
        direction === 'horizontal' ? 'layout-space-horizontal' : ''
      } ${classNames(className, 'inline-edit-container')}`}
      data-testid="inline-edit-container"
      direction={direction === 'vertical' ? 'col' : 'row'}
      gap={2}
      itemClassName="layout-space-item"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={handleKeyDown}>
      {children}

      <Box
        inline
        align="center"
        className="layout-space layout-space-horizontal w-full justify-end"
        data-testid="buttons"
        gap={1}
        itemClassName="layout-space-item">
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
      </Box>
    </Box>
  );
};

export default InlineEdit;
