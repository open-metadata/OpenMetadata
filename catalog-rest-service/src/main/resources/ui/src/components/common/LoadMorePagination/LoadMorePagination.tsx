import React from 'react';
import { Button } from '../../buttons/Button/Button';
import Loader from '../../Loader/Loader';

type LoadMorePaginationProps = {
  isLoading: boolean;
  status: 'initial' | 'waiting' | 'success';
  buttonText: string;
  handleClick: () => void;
};

const LoadMorePagination = ({
  isLoading,
  status,
  buttonText,
  handleClick,
}: LoadMorePaginationProps) => {
  return (
    <div className="tw-my-4 tw-flex tw-justify-center tw-items-center">
      {isLoading ? (
        <Button
          disabled
          className="tw-h-10"
          size="regular"
          theme="primary"
          variant="contained">
          <Loader size="small" type="white" />
          <span className="tw-pl-1.5">Loading</span>{' '}
        </Button>
      ) : status === 'success' ? (
        <Button
          disabled
          className="tw-h-10 disabled:tw-opacity-100"
          size="regular"
          theme="primary"
          variant="contained">
          <i aria-hidden="true" className="fa fa-check" />
        </Button>
      ) : (
        <Button
          className="tw-h-10"
          data-testid="saveManageTab"
          size="regular"
          theme="primary"
          variant="contained"
          onClick={handleClick}>
          <span>{buttonText}</span>
        </Button>
      )}
    </div>
  );
};

export default LoadMorePagination;
