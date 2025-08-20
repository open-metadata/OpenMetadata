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
import { split } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import CloseIcon from '../../../assets/svg/close.svg?react';
import LineArrowRight from '../../../assets/svg/line-arrow-right.svg?react';
import { ROUTES } from '../../../constants/constants';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import brandClassBase from '../../../utils/BrandData/BrandClassBase';
import { getEntityName } from '../../../utils/EntityUtils';
import './welcome-screen.style.less';

const { Paragraph, Text } = Typography;

interface WelcomeScreenProps {
  onClose: () => void;
}

const WelcomeScreen = ({ onClose }: WelcomeScreenProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();

  const userName = useMemo(() => {
    return split(getEntityName(currentUser), ' ')[0];
  }, [currentUser]);

  const { title, welcomeScreenImg } = useMemo(() => {
    return {
      title: brandClassBase.getPageTitle(),
      welcomeScreenImg: brandClassBase.getWelcomeScreenImg(),
    };
  }, []);

  return (
    <Card
      className="welcome-screen-container card-body-border-none card-padding-0"
      data-testid="welcome-screen"
      extra={
        <Button
          className="flex-center welcome-screen-close-btn"
          data-testid="welcome-screen-close-btn"
          icon={<CloseIcon height={12} width={12} />}
          type="text"
          onClick={onClose}
        />
      }>
      <Row className="p-md welcome-screen-full-height">
        <Col className="flex-center" span={12}>
          <img
            alt="welcome screen image"
            className="welcome-screen-img"
            data-testid="welcome-screen-img"
            loading="lazy"
            src={welcomeScreenImg}
          />
        </Col>
        <Col span={12}>
          <Space className="m-y-xlg" direction="vertical">
            <div>
              <Paragraph className="welcome-screen-header-first-line m-b-0">
                {t('message.hi-user-welcome-to', {
                  user: userName || t('label.user'),
                })}
              </Paragraph>
              <Paragraph className="welcome-screen-header-second-line m-b-0">
                {`${title}! 🎉`}
              </Paragraph>
            </div>
            <Divider className="welcome-screen-header-divider" />

            <Paragraph className="m-b-0 text-base">
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

export default WelcomeScreen;
