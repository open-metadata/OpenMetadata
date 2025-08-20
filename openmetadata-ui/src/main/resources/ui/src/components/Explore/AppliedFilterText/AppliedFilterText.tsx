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

import Icon from '@ant-design/icons/lib/components/Icon';
import { Button, Space, Typography } from 'antd';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import EditIcon from '../../../assets/svg/edit-new.svg?react';
import IconSuccessBadge from '../../../assets/svg/success-badge.svg?react';
import './applied-filter-text.less';

interface AppliedFilterTextProps {
  filterText: string;
  onEdit: () => void;
}

const AppliedFilterText: FC<AppliedFilterTextProps> = ({
  filterText,
  onEdit,
}) => {
  const { t } = useTranslation();

  return (
    <Space
      className="p-x-xs w-full"
      data-testid="advance-search-filter-container"
      direction="vertical">
      <Typography.Text className="text-grey-muted">
        {t('label.applied-advanced-search')}
      </Typography.Text>
      <Space
        align="center"
        className="w-full advanced-filter-text justify-between">
        <Space className="w-full">
          <Icon
            alt="success-badge"
            className="align-middle m-l-xs"
            component={IconSuccessBadge}
            style={{ fontSize: '16px' }}
          />
          <Typography data-testid="advance-search-filter-text">
            {filterText}
          </Typography>
        </Space>
        <Button
          className="flex-center"
          data-testid="advance-search-filter-btn"
          icon={<EditIcon width={16} />}
          type="text"
          onClick={onEdit}
        />
      </Space>
    </Space>
  );
};

export default AppliedFilterText;
