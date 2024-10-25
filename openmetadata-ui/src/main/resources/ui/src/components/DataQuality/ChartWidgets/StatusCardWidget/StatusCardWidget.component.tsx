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
import { Space, Tooltip, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { PRIMARY_COLOR } from '../../../../constants/Color.constants';
import './status-card-widget.less';
import { StatusCardWidgetProps } from './StatusCardWidget.interface';

const StatusDataWidget = ({ statusData, icon }: StatusCardWidgetProps) => {
  const IconSvg = icon;
  const { t } = useTranslation();

  return (
    <Space
      align="center"
      className="w-full"
      data-testid="status-data-widget"
      direction="vertical"
      size={16}>
      <div className="d-flex items-center gap-2">
        <IconSvg color={PRIMARY_COLOR} height={20} width={20} />
        <Typography.Text
          className="font-medium text-md text-grey-muted"
          data-testid="status-title">
          {statusData.title}
        </Typography.Text>
      </div>
      <Typography.Text
        className="font-medium text-md"
        data-testid="total-value">
        {statusData.total}
      </Typography.Text>
      <div className="d-flex items-center gap-3">
        <Tooltip title={t('label.success')}>
          <div
            className="status-count-container success"
            data-testid="success-count">
            {statusData.success}
          </div>
        </Tooltip>
        <Tooltip title={t('label.aborted')}>
          <div
            className="status-count-container aborted"
            data-testid="aborted-count">
            {statusData.aborted}
          </div>
        </Tooltip>
        <Tooltip title={t('label.failed')}>
          <div
            className="status-count-container failed"
            data-testid="failed-count">
            {statusData.failed}
          </div>
        </Tooltip>
      </div>
    </Space>
  );
};

export default StatusDataWidget;
