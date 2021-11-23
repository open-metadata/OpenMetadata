import { LoadingState } from 'Models';
import React from 'react';
import { Button } from '../../buttons/Button/Button';
import Loader from '../../Loader/Loader';

type LoadMorePaginationProps = {
  isLoading: boolean;
  showLoadingText?: boolean;
  status: LoadingState;
  buttonText: string;
  handleClick: () => void;
};

const LoadMorePagination = ({
  isLoading,
  status,
  buttonText,
  showLoadingText,
  handleClick,
}: LoadMorePaginationProps) => {
  return (
    <>
      {isLoading ? (
        <Button
          disabled
          className="tw-h-10"
          size="regular"
          theme="primary"
          variant="contained">
          <Loader size="small" type="white" />
          {showLoadingText && <span className="tw-pl-1.5">Loading</span>}
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
    </>
  );
};

export default LoadMorePagination;
