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

import { InboxOutlined } from '@ant-design/icons';
import type { TabsProps, UploadProps } from 'antd';
import { Button, Input, message, Popover, Tabs, Upload } from 'antd';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as LightningIcon } from '../../../../assets/svg/domain-icons/lightning-01.svg';
import { ReactComponent as DeleteIcon } from '../../../../assets/svg/ic-trash-bin.svg';
import { SearchInput } from '../../../common/EntityTable/SearchInput/SearchInput.component';
import { DOMAIN_ICONS } from './icon-selector.constant';
import { DomainIcon, IconSelectorProps } from './IconSelector.interface';

import './icon-selector.less';

const IconSelector: React.FC<IconSelectorProps> = ({
  open,
  selectedIconFileName,
  selectedIconUrl,
  onIconSelect,
  onUrlSelect,
  onClear,
  onClose,
}) => {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState('');
  const [urlValue, setUrlValue] = useState(selectedIconUrl || '');
  const [activeTab, setActiveTab] = useState('icons');

  const filteredIcons = DOMAIN_ICONS.filter((icon: DomainIcon) =>
    icon.displayName.toLowerCase().includes(searchValue.toLowerCase())
  );

  const handleIconClick = (fileName: string) => {
    onIconSelect(fileName);
  };

  const handleDefaultIconClick = () => {
    onIconSelect('lightning-01.svg');
  };

  const handleUrlSubmit = () => {
    if (urlValue.trim()) {
      onUrlSelect(urlValue.trim());
      setUrlValue('');
      onClose();
    }
  };

  const handleDelete = () => {
    setSearchValue('');
    setUrlValue('');
    onClear();
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
  };

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    accept: 'image/*',
    showUploadList: false,
    beforeUpload: (file) => {
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        message.error(t('message.only-image-files-allowed'));

        return false;
      }
      // TODO: Implement image upload functionality
      message.info(t('message.upload-functionality-coming-soon'));

      return false; // Prevent automatic upload
    },
  };

  const tabItems: TabsProps['items'] = [
    {
      key: 'icons',
      label: t('label.icon-plural'),
      children: (
        <div className="icon-picker-content">
          <div className="search-container">
            <SearchInput
              className="search-input"
              placeholder={t('label.search-for-type', {
                type: t('label.icon-plural'),
              })}
              value={searchValue}
              onChange={handleSearchChange}
            />
          </div>

          <div className="default-section">
            <div className="section-title">{t('label.default')}</div>
            <div className="default-icon">
              <div
                className={`icon-item default ${
                  selectedIconFileName === 'lightning-01.svg' ? 'selected' : ''
                }`}
                onClick={handleDefaultIconClick}>
                <LightningIcon className="domain-icon" />
              </div>
            </div>
          </div>

          <div className="icons-section">
            <div className="section-title">{t('label.icon-plural')}</div>
            <div className="icons-grid">
              {filteredIcons.map((icon: DomainIcon) => {
                const IconComponent = icon.svg;
                const isSelected = selectedIconFileName === icon.fileName;

                return (
                  <div
                    className={`icon-item ${isSelected ? 'selected' : ''}`}
                    key={icon.fileName}
                    title={icon.displayName}
                    onClick={() => handleIconClick(icon.fileName)}>
                    <IconComponent className="domain-icon" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'url',
      label: t('label.url-uppercase'),
      children: (
        <div className="url-content">
          <div className="url-input-container">
            <Input
              placeholder={t('label.enter-entity', {
                entity: t('label.url-uppercase'),
              })}
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              onPressEnter={handleUrlSubmit}
            />
            <Button type="primary" onClick={handleUrlSubmit}>
              {t('label.add')}
            </Button>
          </div>
        </div>
      ),
    },
    {
      key: 'upload',
      label: t('label.upload-image'),
      disabled: true,
      children: (
        <div className="upload-content">
          <Upload.Dragger {...uploadProps} className="upload-dragger">
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">
              {t('message.click-or-drag-file-to-upload')}
            </p>
            <p className="ant-upload-hint">{t('message.image-upload-hint')}</p>
          </Upload.Dragger>
        </div>
      ),
    },
  ];

  const content = (
    <div className="icon-picker-popover">
      <div className="popover-header">
        <Tabs
          activeKey={activeTab}
          className="icon-picker-tabs"
          items={tabItems}
          onChange={setActiveTab}
        />
        <Button
          className="delete-button"
          icon={<DeleteIcon />}
          size="small"
          type="text"
          onClick={handleDelete}
        />
      </div>
    </div>
  );

  if (!open) {
    return null;
  }

  return (
    <Popover
      content={content}
      open={open}
      overlayClassName="icon-picker-overlay"
      placement="bottomLeft"
      title={null}
      trigger="click"
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}>
      <div />
    </Popover>
  );
};

export { IconSelector };
