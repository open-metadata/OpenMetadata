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
import { Button } from '@openmetadata/ui-core-components';
import { Space } from 'antd';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import './inline-edit.less';
import { InlineEditButtonProps, InlineEditProps } from './InlineEdit.interface';

const toCoreButtonProps = ({
  htmlType,
  ...rest
}: InlineEditButtonProps = {}) => ({ ...rest, type: htmlType });

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
  const { t } = useTranslation();
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
          aria-label={t('label.cancel')}
          className="tw:size-6 tw:p-0!"
          color="primary"
          data-testid="inline-cancel-btn"
          iconLeading={CloseOutlined}
          isDisabled={isLoading}
          size="sm"
          onClick={onCancel}
          {...toCoreButtonProps(cancelButtonProps)}
        />
        <Button
          aria-label={t('label.save')}
          className="tw:size-6 tw:p-0!"
          color="primary"
          data-testid="inline-save-btn"
          iconLeading={CheckOutlined}
          isLoading={isLoading}
          size="sm"
          onClick={onSave}
          {...toCoreButtonProps(saveButtonProps)}
        />
      </Space>
    </Space>
  );
};

export default InlineEdit;
