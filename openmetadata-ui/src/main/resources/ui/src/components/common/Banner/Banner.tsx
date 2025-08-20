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
import { LoadingOutlined } from '@ant-design/icons';
import { Spin } from 'antd';
import classNames from 'classnames';
import { FC } from 'react';
import ErrorIcon from '../../../assets/svg/banner/ic-banner-error.svg?react';
import SuccessIcon from '../../../assets/svg/banner/ic-banner-success.svg?react';
import './banner.less';

export interface BannerProps extends React.HTMLAttributes<HTMLDivElement> {
  type: 'success' | 'error';
  message: string;
  isLoading?: boolean;
}

const Banner: FC<BannerProps> = ({ type, message, className, isLoading }) => {
  const icon = type === 'success' ? <SuccessIcon /> : <ErrorIcon />;

  return (
    <div className={classNames('message-banner-wrapper', type, className)}>
      {isLoading ? (
        <Spin
          className={`loading-spinner-${type}`}
          indicator={<LoadingOutlined spin />}
          size="small"
        />
      ) : (
        icon
      )}
      <span className="message-banner-text">{message}</span>
    </div>
  );
};

export default Banner;
