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
import {
  Alert02,
  CheckCircle,
  InfoCircle,
  Loading01,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { FC } from 'react';
import './banner.less';

export interface BannerProps extends React.HTMLAttributes<HTMLDivElement> {
  type: 'success' | 'error' | 'info';
  message: string;
  isLoading?: boolean;
}

const getIcon = (type: BannerProps['type']) => {
  switch (type) {
    case 'success':
      return <CheckCircle className="tw:text-utility-success-700" size={25} />;
    case 'error':
      return <Alert02 className="tw:text-utility-error-500" />;
    case 'info':
      return <InfoCircle aria-hidden className="info-icon" size={16} />;
    default:
      return <CheckCircle className="tw:text-utility-success-700" size={25} />;
  }
};

const Banner: FC<BannerProps> = ({ type, message, className, isLoading }) => {
  const icon = getIcon(type);

  return (
    <div className={classNames('message-banner-wrapper', type, className)}>
      {isLoading ? (
        <Loading01
          aria-hidden
          className={`loading-spinner-${type} tw:animate-spin`}
          size={14}
        />
      ) : (
        icon
      )}
      <span className="message-banner-text">{message}</span>
    </div>
  );
};

export default Banner;
