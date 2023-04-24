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
import { Button, Card, Col, Divider, Row, Space, Typography } from 'antd';
import WelcomeScreenImg from 'assets/img/welcome-screen.png';
import { ReactComponent as CloseIcon } from 'assets/svg/close.svg';
import { ReactComponent as LineArrowRight } from 'assets/svg/line-arrow-right.svg';
import React, { useMemo } from 'react';

import AppState from 'AppState';
import { ROUTES } from 'constants/constants';
import { observer } from 'mobx-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getEntityName } from 'utils/EntityUtils';
import './welcome-screen.style.less';

const { Paragraph, Text } = Typography;

interface WelcomeScreenProps {
  onClose: () => void;
}

const WelcomeScreen = ({ onClose }: WelcomeScreenProps) => {
  const { t } = useTranslation();
  const userName = useMemo(() => {
    const user = AppState.getCurrentUserDetails();

    return getEntityName(user);
  }, [AppState]);

  return (
    <Card
      className="welcome-screen-container"
      extra={
        <Button
          className="flex-center welcome-screen-close-btn"
          icon={<CloseIcon height={10} width={10} />}
          shape="circle"
          onClick={onClose}
        />
      }>
      <Row gutter={16}>
        <Col span={12}>
          <img
            alt="welcome screen image"
            data-testid="welcome-screen-img"
            loading="lazy"
            src={WelcomeScreenImg}
          />
        </Col>
        <Col span={12}>
          <Space direction="vertical">
            <div>
              <Paragraph className="welcome-screen-header-first-line m-b-0">
                {t('message.hi-user-welcome-to', {
                  user: userName ?? t('label.user'),
                })}
              </Paragraph>
              <Paragraph className="welcome-screen-header-second-line m-b-0">
                {`${t('label.open-metadata')}! 🎉`}
              </Paragraph>
            </div>
            <Divider className="welcome-screen-header-divider" />

            <Paragraph className="m-b-lg">
              {t('message.welcome-screen-message')}
            </Paragraph>
            <Link className="flex items-center gap-2 p-0" to={ROUTES.TOUR}>
              <Text className="welcome-screen-button-text">
                {t('message.take-quick-product-tour')}
              </Text>
              <LineArrowRight className="text-primary" height={14} width={18} />
            </Link>
          </Space>
        </Col>
      </Row>
    </Card>
  );
};

export default observer(WelcomeScreen);
