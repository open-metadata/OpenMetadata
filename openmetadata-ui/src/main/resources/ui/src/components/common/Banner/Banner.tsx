import React, { FC } from 'react';
import './banner.less';

import { LoadingOutlined } from '@ant-design/icons';
import { Spin } from 'antd';
import classNames from 'classnames';
import { ReactComponent as ErrorIcon } from '../../../assets/svg/banner/ic-banner-error.svg';
import { ReactComponent as SuccessIcon } from '../../../assets/svg/banner/ic-banner-success.svg';

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
