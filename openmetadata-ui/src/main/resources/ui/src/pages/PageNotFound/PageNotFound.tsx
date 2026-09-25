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

import { Button } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import notFoundImage from '../../assets/img/404-image.png';
import notFoundNumber from '../../assets/svg/404-number.svg';
import DocumentTitle from '../../components/common/DocumentTitle/DocumentTitle';
import { ROUTES } from '../../constants/constants';

const PageNotFound = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div
      className="tw:relative tw:flex tw:min-h-screen tw:w-full tw:items-center tw:overflow-hidden tw:bg-primary tw:px-6"
      data-testid="no-page-found">
      <DocumentTitle title={t('label.page-not-found')} />

      <div className="tw:mx-auto tw:grid tw:w-full tw:max-w-[1200px] tw:grid-cols-1 tw:items-center tw:gap-8 tw:md:grid-cols-2">
        <div className="tw:flex tw:flex-col tw:items-center tw:justify-center tw:text-center tw:md:items-start tw:md:text-left">
          <h1 className="tw:mb-2 tw:text-display-md tw:font-bold tw:text-tertiary">
            {t('label.page-not-found')}
          </h1>
          <p className="tw:mb-6 tw:text-lg tw:text-tertiary">
            {t('message.page-is-not-available')}
          </p>
          <div
            className="tw:flex tw:flex-wrap tw:items-center tw:gap-3"
            data-testid="route-links">
            <Button
              color="primary"
              data-testid="go-home"
              size="md"
              onPress={() => navigate(ROUTES.HOME)}>
              {t('label.go-to-home-page')}
            </Button>
            <Button
              color="secondary"
              data-testid="go-explore"
              size="md"
              onPress={() => navigate(ROUTES.EXPLORE)}>
              {t('label.explore')}
            </Button>
          </div>
        </div>

        <div className="tw:flex tw:items-center tw:justify-center">
          <img
            alt={t('label.not-found-lowercase')}
            className="tw:max-h-[420px] tw:w-auto tw:object-contain"
            src={notFoundImage}
          />
        </div>
      </div>

      <img
        aria-hidden
        alt={t('label.not-found-lowercase')}
        className="tw:pointer-events-none tw:absolute tw:right-0 tw:top-0 tw:hidden tw:h-40 tw:w-auto tw:opacity-40 tw:lg:block"
        src={notFoundNumber}
      />
    </div>
  );
};

export default PageNotFound;
