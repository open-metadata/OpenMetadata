/*
 *  Copyright 2022 Collate.
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

import { faArrowLeft, faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button } from 'antd';
import React, { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CursorType } from '../../../enums/pagination.enum';
import { Paging } from '../../../generated/type/paging';

interface Prop {
  paging: Paging;
  pagingHandler: (cursorValue: string | number, activePage?: number) => void;
  totalCount: number;
  pageSize: number;
  currentPage: number;
  isNumberBased?: boolean;
}

const computeTotalPages = (pSize: number, total: number) => {
  return Math.ceil(total / pSize);
};

const NextPrevious: FC<Prop> = ({
  paging,
  pagingHandler,
  totalCount,
  pageSize,
  isNumberBased = false,
  currentPage,
}: Prop) => {
  const { t } = useTranslation();
  const [activePage, setActivePage] = useState(1);

  const onNextHandler = () => {
    setActivePage(activePage + 1);
    if (isNumberBased) {
      pagingHandler(activePage + 1);
    } else {
      pagingHandler(CursorType.AFTER, activePage + 1);
    }
  };

  const onPreviousHandler = () => {
    setActivePage(activePage - 1);
    if (isNumberBased) {
      pagingHandler(activePage - 1);
    } else {
      pagingHandler(CursorType.BEFORE, activePage - 1);
    }
  };

  const computePrevDisableState = () => {
    if (isNumberBased) {
      return activePage === 1;
    } else {
      return paging.before ? false : true;
    }
  };

  const computeNextDisableState = () => {
    if (isNumberBased) {
      const totalPages = computeTotalPages(pageSize, totalCount);

      return activePage === totalPages;
    } else {
      return paging.after ? false : true;
    }
  };

  useEffect(() => {
    setActivePage(currentPage);
  }, [currentPage]);

  return (
    <div
      className="tw-my-4 tw-flex tw-justify-center tw-items-center tw-gap-2"
      data-testid="pagination">
      <Button
        ghost
        className="hover-button text-sm flex-center"
        data-testid="previous"
        disabled={computePrevDisableState()}
        type="primary"
        onClick={onPreviousHandler}>
        <FontAwesomeIcon className="text-sm p-r-xs" icon={faArrowLeft} />
        <span>{t('label.previous')}</span>
      </Button>
      <span
        className="tw-px-2"
        data-testid="page-indicator">{`${activePage}/${computeTotalPages(
        pageSize,
        totalCount
      )} Page`}</span>
      <Button
        ghost
        className="hover-button text-sm flex-center"
        data-testid="next"
        disabled={computeNextDisableState()}
        type="primary"
        onClick={onNextHandler}>
        <span> {t('label.next')}</span>
        <FontAwesomeIcon className="text-sm p-l-xs" icon={faArrowRight} />
      </Button>
    </div>
  );
};

export default NextPrevious;
