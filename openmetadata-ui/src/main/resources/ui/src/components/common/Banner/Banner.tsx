import React, { FC } from 'react';
import './banner.less';

import classNames from 'classnames';
import { ReactComponent as ErrorIcon } from '../../../assets/svg/banner/ic-banner-error.svg';
import { ReactComponent as SuccessIcon } from '../../../assets/svg/banner/ic-banner-success.svg';

export interface BannerProps extends React.HTMLAttributes<HTMLDivElement> {
  type: 'success' | 'error';
  message: string;
}

const Banner: FC<BannerProps> = ({ type, message, className }) => {
  return (
    <div className={classNames('message-banner-wrapper', type, className)}>
      {type === 'success' ? <SuccessIcon /> : <ErrorIcon />}
      <span className="message-banner-text">{message}</span>
    </div>
  );
};

export default Banner;
