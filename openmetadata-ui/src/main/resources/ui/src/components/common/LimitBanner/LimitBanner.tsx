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
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLimitStore } from '../../../context/LimitsProvider/useLimitsStore';
import { useTourProvider } from '../../../context/TourProvider/TourProvider';
import { getSettingsLink } from '../../../utils/SettingsModalLinkUtils';
import { ReactComponent as CloseIcon } from './../../../assets/svg/close.svg';
import { ReactComponent as WarningIcon } from './../../../assets/svg/ic-warning-2.svg';
import './limit-banner.less';

export const LimitBanner = () => {
  const { t } = useTranslation();
  const { bannerDetails, setBannerDetails } = useLimitStore();
  const { isTourPage, isTourOpen } = useTourProvider();

  const showBanner = bannerDetails && !(isTourOpen || isTourPage);

  return (
    <header
      className={classNames('pricing-banner', {
        errored: bannerDetails?.type === 'danger',
      })}
      hidden={!showBanner}>
      <div className="d-flex ">
        <WarningIcon className="tw:self-center tw:size-6 tw:shrink-0" />
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
      <CloseIcon
        className="tw:p-0 tw:cursor-pointer tw:size-3.5 tw:shrink-0 tw:text-quaternary"
        onClick={() => setBannerDetails(null)}
      />
    </header>
  );
};
