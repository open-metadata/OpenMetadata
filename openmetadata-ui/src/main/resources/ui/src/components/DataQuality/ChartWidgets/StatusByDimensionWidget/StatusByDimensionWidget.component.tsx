/*
 *  Copyright 2024 Collate.
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
import { Card, Space, Tooltip, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as TestCaseIcon } from '../../../../assets/svg/all-activity-v2.svg';
import { PRIMARY_COLOR } from '../../../../constants/Color.constants';
import './status-by-dimension-widget.less';
import { StatusByDimensionWidgetProps } from './StatusByDimensionWidget.interface';

const StatusByDimensionWidget = ({
  isLoading,
  statusByDimension,
}: StatusByDimensionWidgetProps) => {
  const { t } = useTranslation();

  return (
    <Card loading={isLoading}>
      <Space align="center" className="w-full" direction="vertical" size={16}>
        <div className="d-flex items-center gap-2">
          <TestCaseIcon color={PRIMARY_COLOR} height={20} width={20} />
          <Typography.Text className="font-medium text-md text-grey-muted">
            {statusByDimension.title}
          </Typography.Text>
        </div>
        <Typography.Text className="font-medium text-md">
          {statusByDimension.total}
        </Typography.Text>
        <div className="d-flex items-center gap-3">
          <Tooltip title={t('label.success')}>
            <div className="status-count-container success">
              {statusByDimension.success}
            </div>
          </Tooltip>
          <Tooltip title={t('label.aborted')}>
            <div className="status-count-container aborted">
              {statusByDimension.aborted}
            </div>
          </Tooltip>
          <Tooltip title={t('label.failed')}>
            <div className="status-count-container failed">
              {statusByDimension.failed}
            </div>
          </Tooltip>
        </div>
      </Space>
    </Card>
  );
};

export default StatusByDimensionWidget;
