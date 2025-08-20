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
/* eslint-disable i18next/no-literal-string */
import Icon from '@ant-design/icons';
import { Header } from 'antd/lib/layout/layout';
import classNames from 'classnames';
import { Link } from 'react-router-dom';
import { useLimitStore } from '../../../context/LimitsProvider/useLimitsStore';
import { useTourProvider } from '../../../context/TourProvider/TourProvider';
import CloseIcon from './../../../assets/svg/close.svg?react';
import WarningIcon from './../../../assets/svg/ic-warning-2.svg?react';
import './limit-banner.less';

export const LimitBanner = () => {
  const { bannerDetails, setBannerDetails } = useLimitStore();
  const { isTourPage, isTourOpen } = useTourProvider();

  const showBanner = bannerDetails && !(isTourOpen || isTourPage);

  return (
    <Header
      className={classNames('pricing-banner', {
        errored: bannerDetails?.type === 'danger',
      })}
      hidden={!showBanner}>
      <div className="d-flex ">
        <Icon
          className="self-center"
          component={WarningIcon}
          style={{ fontSize: '24px' }}
        />
        <div className="p-l-sm">
          <p className="pricing-header">{bannerDetails?.header}</p>
          <p className="pricing-subheader">
            {bannerDetails?.subheader}
            <>
              {' '}
              Learn more about{' '}
              <Link to="/settings/billing/plans">plans and pricing.</Link>
            </>
          </p>
        </div>
      </div>
      <Icon
        className="close-btn p-0 cursor-pointer"
        component={CloseIcon}
        style={{ color: '#546E7A', fontSize: '14px' }}
        onClick={() => setBannerDetails(null)}
      />
    </Header>
  );
};
