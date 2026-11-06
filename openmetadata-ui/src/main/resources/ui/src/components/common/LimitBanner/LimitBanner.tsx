/*
 *  Copyright 2024 Collate.
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
import { ButtonUtility } from '@openmetadata/ui-core-components';
import { Alert, XClose } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLimitStore } from '../../../context/LimitsProvider/useLimitsStore';
import { getSettingsLink } from '../../../utils/SettingsModalLinkUtils';
import './limit-banner.less';

export const LimitBanner = () => {
  const { t } = useTranslation();
  const { bannerDetails, setBannerDetails } = useLimitStore();

  return (
    <header
      className={classNames('pricing-banner', {
        errored: bannerDetails?.type === 'danger',
      })}
      hidden={!bannerDetails}>
      <div className="d-flex ">
        <Alert className="tw:self-center tw:shrink-0" size={24} />
        <div className="p-l-sm">
          <p className="pricing-header">{bannerDetails?.header}</p>
          <p className="pricing-subheader">
            {bannerDetails?.subheader} {t('message.learn-more-about')}{' '}
            <Link to={getSettingsLink('/settings/billing/plans')}>
              {t('label.plans-and-pricing')}
            </Link>
          </p>
        </div>
      </div>
      <ButtonUtility
        icon={XClose}
        size="lg"
        tooltip={t('label.close')}
        onClick={() => setBannerDetails(null)}
      />
    </header>
  );
};
