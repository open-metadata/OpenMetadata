/*
 *  Copyright 2022 Collate.
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

import Icon from '@ant-design/icons/lib/components/Icon';
import { Button, Col, Modal, Row, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import LogoMonogram from '../../../assets/svg/logo-monogram.svg?react';
import { TourEndModalProps } from './TourEndModal.interface';

const TourEndModal = ({ onSave, visible }: TourEndModalProps) => {
  const { t } = useTranslation();

  return (
    <Modal
      closable={false}
      data-testid="modal-container"
      footer={
        <Button
          data-testid="saveButton"
          size="large"
          type="primary"
          onClick={onSave}>
          {t('label.explore-now')}
        </Button>
      }
      maskClosable={false}
      open={visible}>
      <Row className="text-center" gutter={[16, 16]}>
        <Col className="mt-4" span={24}>
          <Icon
            alt={t('label.open-metadata-logo')}
            className="align-middle"
            component={LogoMonogram}
            data-testid="omd-logo"
            style={{ fontSize: '70px' }}
          />
        </Col>
        <Col span={24}>
          <Typography
            className="text-base mt-5"
            data-testid="tour-complete-message">
            {t('message.successfully-completed-the-tour')}
            <br />
            {t('message.get-started-with-open-metadata')}
          </Typography>
        </Col>
      </Row>
    </Modal>
  );
};

export default TourEndModal;
