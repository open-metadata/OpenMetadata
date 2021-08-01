import { Paging } from 'Models';
import React from 'react';
import { CursorType } from '../../../enums/pagination.enum';
import { Button } from '../../buttons/Button/Button';

type Prop = {
  paging: Paging;
  pagingHandler: (value: string) => void;
};

const NextPrevious = ({ paging, pagingHandler }: Prop) => {
  return (
    <div className="tw-my-4 tw-flex tw-justify-center tw-items-center  tw-gap-2">
      <Button
        className="tw-rounded tw-w-24  tw-px-3 tw-py-1.5 tw-text-sm"
        disabled={paging.before ? false : true}
        size="custom"
        theme="primary"
        variant="outlined"
        onClick={() => pagingHandler(CursorType.BEFORE)}>
        <i className="fas fa-arrow-left tw-text-sm tw-align-middle tw-pr-1.5" />{' '}
        <span>Previous</span>
      </Button>
      <Button
        className="tw-rounded tw-w-24 tw-px-3 tw-py-1.5 tw-text-sm"
        disabled={paging.after ? false : true}
        size="custom"
        theme="primary"
        variant="outlined"
        onClick={() => pagingHandler(CursorType.AFTER)}>
        <span> Next</span>{' '}
        <i className="fas fa-arrow-right tw-text-sm tw-align-middle tw-pl-1.5" />
      </Button>
    </div>
  );
};

export default NextPrevious;
