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
import Icon from '@ant-design/icons';
import { Button, Pagination, PaginationProps } from 'antd';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ArrowRightOutlined } from '../../assets/svg/arrow-right.svg';

const PaginationComponent = (props: PaginationProps) => {
  const { t } = useTranslation();
  const itemRender: PaginationProps['itemRender'] = (
    _,
    type,
    originalElement
  ) => {
    if (type === 'prev') {
      return (
        <Button
          className="pagination-button hover-button"
          data-testid="previous"
          icon={
            <Icon
              className="pagination-prev-icon"
              component={ArrowRightOutlined}
            />
          }
          type="text">
          <span>{t('label.previous')}</span>
        </Button>
      );
    }
    if (type === 'next') {
      return (
        <Button
          className="pagination-button hover-button"
          data-testid="next"
          type="text">
          <span> {t('label.next')}</span>
          <Icon
            className="pagination-next-icon"
            component={ArrowRightOutlined}
          />
        </Button>
      );
    }

    return originalElement;
  };

  return (
    <Pagination
      hideOnSinglePage
      itemRender={itemRender}
      pageSizeOptions={[10, 25, 50]}
      {...props}
    />
  );
};

export default PaginationComponent;
