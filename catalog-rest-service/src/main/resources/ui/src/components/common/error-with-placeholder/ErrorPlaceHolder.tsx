import React from 'react';
import NoDataFound from '../../../assets/svg/no-data-found.svg';

const ErrorPlaceHolder = () => {
  return (
    <div className="tw-flex tw-flex-col tw-mt-24 tw-place-items-center">
      {' '}
      <img src={NoDataFound} width="500" />
    </div>
  );
};

export default ErrorPlaceHolder;
