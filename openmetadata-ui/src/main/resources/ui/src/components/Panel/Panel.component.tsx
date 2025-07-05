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

import { CloseOutlined } from '@ant-design/icons';
import { Button, Drawer, Typography } from 'antd';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import panelTitleBg from '../../assets/img/panel-title-bg.png';
import { PanelProps } from './Panel.interface';
import './panel.less';

const { Title, Text } = Typography;

export function Panel({
  open,
  onClose,
  title,
  description,
  placement = 'right',
  size = 720,
  children,
  footer,
  closable = true,
  mask = true,
  maskClosable = true,
  className,
  'data-testid': dataTestId = 'panel',
  cancelLabel,
  saveLabel,
  onCancel,
  onSave,
  saveLoading = false,
  saveDisabled = false,
}: PanelProps) {
  const { t } = useTranslation();

  const panelClassNames = classNames('panel-container', className);

  const headerContent = (
    <div className="panel-header" data-testid={`${dataTestId}-header`}>
      <div className="absolute inset-0">
        <img
          alt="panel-title-bg"
          className="w-full h-full"
          src={panelTitleBg}
        />
      </div>
      <div className="panel-header-content">
        <Title
          className="panel-title"
          data-testid={`${dataTestId}-title`}
          level={4}>
          {title}
        </Title>
        {description && (
          <Text
            className="panel-description"
            data-testid={`${dataTestId}-description`}>
            {description}
          </Text>
        )}
      </div>
      {closable && (
        <Button
          className="panel-close-button"
          data-testid={`${dataTestId}-close-button`}
          icon={<CloseOutlined />}
          type="text"
          onClick={onClose}
        />
      )}
    </div>
  );

  const defaultFooter = (
    <div className="panel-footer" data-testid={`${dataTestId}-footer`}>
      <Button
        className="panel-footer-btn"
        data-testid={`${dataTestId}-cancel-button`}
        type="link"
        onClick={onCancel || onClose}>
        {cancelLabel || t('label.cancel')}
      </Button>
      <Button
        className="panel-footer-btn"
        data-testid={`${dataTestId}-save-button`}
        disabled={saveDisabled}
        loading={saveLoading}
        type="primary"
        onClick={onSave}>
        {saveLabel || t('label.save')}
      </Button>
    </div>
  );

  const footerContent = footer || defaultFooter;

  return (
    <Drawer
      className={panelClassNames}
      closable={false}
      data-testid={dataTestId}
      footer={footerContent}
      height={placement === 'top' || placement === 'bottom' ? size : undefined}
      mask={mask}
      maskClosable={maskClosable}
      open={open}
      placement={placement}
      title={headerContent}
      width={placement === 'left' || placement === 'right' ? size : undefined}
      onClose={onClose}>
      <div className="panel-content" data-testid={`${dataTestId}-content`}>
        {children}
      </div>
    </Drawer>
  );
}
