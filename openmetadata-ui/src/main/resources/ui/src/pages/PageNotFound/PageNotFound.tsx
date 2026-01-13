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

import { Button, Col, Row, Space, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import notFoundImage from '../../assets/img/404-image.png';
import notFoundNumber from '../../assets/svg/404-number.svg';
import { ROUTES } from '../../constants/constants';
import './page-not-found.less';

const PageNotFound = () => {
  const { t } = useTranslation();

  return (
    <Row className="page-not-found-container" data-testid="no-page-found">
      <Col className="flex-center flex-column text-column" span={12}>
        <Typography.Text className="text-3xl font-bold text-grey-muted m-b-xs">
          {t('label.page-not-found')}
        </Typography.Text>
        <Typography.Paragraph className="text-lg text-grey-muted-muted">
          {t('message.page-is-not-available')}
        </Typography.Paragraph>
        <Space data-testid="route-links" size="middle">
          <Link to={ROUTES.HOME}>
            <Button type="primary">{t('label.go-to-home-page')}</Button>
          </Link>
          <Link to={ROUTES.EXPLORE}>
            <Button ghost type="primary">
              {t('label.explore')}
            </Button>
          </Link>
        </Space>
      </Col>
      <Col className="flex-center image-column" span={12}>
        <img alt={t('label.not-found-lowercase')} src={notFoundImage} />
      </Col>

      <img
        alt={t('label.not-found-lowercase')}
        className="not-found-text-image"
        src={notFoundNumber}
      />
    </Row>
  );
};

export default PageNotFound;
