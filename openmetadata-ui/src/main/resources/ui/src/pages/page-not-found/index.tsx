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

import { Button } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import notFoundImage from '../../assets/img/404-image.webp';
import notFoundNumber from '../../assets/svg/404-number.svg';
import { ROUTES } from '../../constants/constants';

const PageNotFound = () => {
  const { t } = useTranslation();

  return (
    <div
      className="page-not-found-container tw-relative"
      data-testid="no-page-found">
      <div className="tw-flex-center tw-hw-full tw-absolute tw-inset-0">
        <img alt={t('label.not-found')} src={notFoundNumber} />
      </div>
      <div className="tw-flex tw-hw-full tw-absolute tw-inset-0">
        <div className="tw-hw-full tw-flex-center">
          <div className="tw-text-center">
            <h4 className="tw-font-bold tw-text-3xl tw-text-grey-muted">
              {t('label.page-not-found')}
            </h4>
            <p className="tw-text-lg tw-text-grey-muted-muted">
              {t('message.page-is-not-available')}
            </p>
            <div className="tw-text-center tw-mt-10" data-testid="route-links">
              <Link to={ROUTES.HOME}>
                <Button className="tw-mr-5" type="primary">
                  {t('label.go-to-home-page')}
                </Button>
              </Link>
              <Link to={ROUTES.EXPLORE}>
                <Button ghost type="primary">
                  {t('label.explore')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
        <div className="tw-hw-full tw-flex-center">
          <img alt={t('label.not-found')} src={notFoundImage} />
        </div>
      </div>
    </div>
  );
};

export default PageNotFound;
