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
import Icon from '@ant-design/icons';
import { Button, Col, Divider, Modal, Row, Typography } from 'antd';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AddIcon } from '../../../../assets/svg/add-square.svg';
import { DEFAULT_HEADER_BG_COLOR } from '../../../../constants/Mydata.constants';
import HeaderTheme from '../../HeaderTheme/HeaderTheme';
import './customise-home-modal.less';

interface CustomiseHomeModalProps {
  onClose: () => void;
  open: boolean;
  onBackgroundColorUpdate?: (color: string) => Promise<void>;
  currentBackgroundColor?: string;
}

const CustomiseHomeModal = ({
  onClose,
  open,
  onBackgroundColorUpdate,
  currentBackgroundColor,
}: CustomiseHomeModalProps) => {
  const { t } = useTranslation();
  const [selectedColor, setSelectedColor] = useState<string>(
    currentBackgroundColor ?? DEFAULT_HEADER_BG_COLOR
  );

  const customiseOptions = [
    {
      key: 'header-theme',
      label: t('label.header-theme'),
      component: (
        <HeaderTheme
          selectedColor={selectedColor}
          setSelectedColor={setSelectedColor}
        />
      ),
    },
    {
      key: 'all-widgets',
      label: t('label.all-widgets'),
      component: <div>{t('label.all-widgets')}</div>,
    },
  ];

  const [selectedKey, setSelectedKey] = useState(customiseOptions[0].key);

  const selectedComponent = customiseOptions.find(
    (item) => item.key === selectedKey
  )?.component;

  const handleApply = () => {
    if (onBackgroundColorUpdate) {
      onBackgroundColorUpdate(selectedColor);
    }
    onClose();
  };

  return (
    <Modal
      centered
      className="customise-home-modal"
      footer={null}
      open={open}
      title={
        <div className="customise-home-modal-header p-box d-flex items-center gap-3">
          <Icon className="add-icon" component={AddIcon} />
          <Typography.Text className="text-xl font-semibold text-white">
            {t('label.customize-entity', {
              entity: t('label.home'),
            })}
          </Typography.Text>
        </div>
      }
      width={1800}
      onCancel={onClose}>
      <Row className="customise-home-modal-body d-flex gap-1">
        <Col className="sidebar p-box sticky top-0 self-start">
          {customiseOptions.map((item) => (
            <div
              className={`sidebar-option text-md font-semibold border-radius-xs cursor-pointer ${
                selectedKey === item.key ? 'active' : ''
              }`}
              data-testid={`sidebar-option-${item.key}`}
              key={item.key}
              onClick={() => setSelectedKey(item.key)}>
              {item.label}
            </div>
          ))}
        </Col>
        <Divider
          className="customise-home-modal-divider h-auto self-stretch"
          type="vertical"
        />
        <Col className="content p-box">{selectedComponent}</Col>
      </Row>
      <Row className="customise-home-modal-footer p-box d-flex justify-end gap-3 bg-white sticky bottom-0">
        <Col className="d-flex items-center gap-4">
          <Button
            className="cancel-btn border-radius-xs font-medium text-md bg-white"
            data-testid="cancel-btn"
            onClick={onClose}>
            {t('label.cancel')}
          </Button>
          <Button
            className="apply-btn border-radius-xs font-semibold text-white text-md"
            data-testid="apply-btn"
            type="primary"
            onClick={handleApply}>
            {t('label.apply')}
          </Button>
        </Col>
      </Row>
    </Modal>
  );
};

export default CustomiseHomeModal;
