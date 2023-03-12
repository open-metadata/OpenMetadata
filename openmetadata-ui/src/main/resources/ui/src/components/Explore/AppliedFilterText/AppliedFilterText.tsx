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

import { Button, Space, Typography } from 'antd';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import './AppliedFilterText.less';

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
    <Space className="w-full" direction="vertical">
      <Typography.Text className="text-grey-muted">
        {t('label.applied-advanced-search')}
      </Typography.Text>
      <Space
        align="center"
        className="w-full advanced-filter-text justify-between">
        <Space className="w-full">
          <SVGIcons
            alt="success-badge"
            icon={Icons.SUCCESS_BADGE}
            width="16px"
          />
          <Typography>{filterText}</Typography>
        </Space>
        <Button
          className="p-0"
          icon={
            <SVGIcons alt="edit" icon={Icons.IC_EDIT_PRIMARY} width="16px" />
          }
          type="text"
          onClick={onEdit}
        />
      </Space>
    </Space>
  );
};

export default AppliedFilterText;
