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
import { Button } from 'antd';
import { Header } from 'antd/lib/layout/layout';
import React from 'react';
import { Link } from 'react-router-dom';
import { useLimitStore } from '../../../context/LimitsProvider/useLimitsStore';
import { ReactComponent as CloseIcon } from './../../../assets/svg/close.svg';
import { ReactComponent as ExternalLinkIcon } from './../../../assets/svg/external-links.svg';
import { ReactComponent as WarningIcon } from './../../../assets/svg/ic-warning-2.svg';

import classNames from 'classnames';
import './limit-banner.less';

export const LimitBanner = () => {
  const { bannerDetails, setBannerDetails } = useLimitStore();

  return (
    <Header
      className={classNames('pricing-banner', {
        errored: bannerDetails?.type === 'danger',
      })}
      hidden={false}>
      <div className="d-flex ">
        <Icon
          className="self-center"
          component={
            bannerDetails?.type === 'danger' ? WarningIcon : WarningIcon
          }
          style={{ fontSize: '24px', color: '#FFAB2A' }}
        />
        <div className="p-l-sm">
          <p className="pricing-header">{bannerDetails?.header}</p>
          <p className="pricing-subheader">{bannerDetails?.subheader}</p>
        </div>
        <div className="m-l-sm d-flex items-end gap-2">
          <Link to="/usage">
            <Button size="small" type="primary">
              View Usage{' '}
              <Icon component={ExternalLinkIcon} style={{ fontSize: '14px' }} />
            </Button>
          </Link>
          <Button
            href="https://www.getcollate.io/"
            size="small"
            target="_blank"
            type="default">
            Learn More{' '}
            <Icon component={ExternalLinkIcon} style={{ fontSize: '14px' }} />
          </Button>
        </div>
      </div>
      <Icon
        className="close-btn p-0 cursor-pointer"
        component={CloseIcon}
        style={{ color: '#546E7A', fontSize: '16px' }}
        onClick={() => setBannerDetails(null)}
      />
    </Header>
  );
};
