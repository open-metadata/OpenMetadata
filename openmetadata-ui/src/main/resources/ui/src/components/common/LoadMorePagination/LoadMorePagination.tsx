/*
 *  Copyright 2021 Collate
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
