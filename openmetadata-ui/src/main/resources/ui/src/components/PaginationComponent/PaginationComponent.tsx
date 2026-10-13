/*
 *  Copyright 2025 Collate.
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
import { Typography } from '@openmetadata/ui-core-components';
import { Pagination, PaginationProps } from 'antd';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ArrowRightOutlined } from '../../assets/svg/arrow-right.svg';
import {
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
} from '../../constants/constants';

// rc-pagination puts the click handler, focus and aria-disabled on its own <li>
// and clones this element with `disabled`. It must stay non-interactive so the
// click reaches the <li>: a react-aria Button would stop the event.
const PageNavLabel = ({
  children,
  disabled,
  ...props
}: {
  children: ReactNode;
  disabled?: boolean;
  'data-testid': string;
}) => (
  <Typography
    {...props}
    aria-disabled={disabled}
    className="tw:inline-flex tw:items-center tw:gap-1 tw:px-2"
    role="button">
    {children}
  </Typography>
);

const PaginationComponent = (props: PaginationProps) => {
  const { t } = useTranslation();
  const itemRender: PaginationProps['itemRender'] = (
    _,
    type,
    originalElement
  ) => {
    if (type === 'prev') {
      return (
        <PageNavLabel data-testid="previous">
          <ArrowRightOutlined className="pagination-prev-icon tw:size-3.5 tw:shrink-0" />
          {t('label.previous')}
        </PageNavLabel>
      );
    }
    if (type === 'next') {
      return (
        <PageNavLabel data-testid="next">
          {t('label.next')}
          <ArrowRightOutlined className="pagination-next-icon tw:size-3.5 tw:shrink-0" />
        </PageNavLabel>
      );
    }

    return originalElement;
  };

  return (
    <Pagination
      hideOnSinglePage
      itemRender={itemRender}
      pageSizeOptions={[PAGE_SIZE_BASE, PAGE_SIZE_MEDIUM, PAGE_SIZE_LARGE]}
      {...props}
    />
  );
};

export default PaginationComponent;
