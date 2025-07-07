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
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PRIMARY_COLOR } from '../../../../constants/Color.constants';
import '../chart-widgets.less';
import './status-card-widget.less';
import { StatusCardWidgetProps } from './StatusCardWidget.interface';

const StatusDataWidget = ({
  statusData,
  icon,
  redirectPath,
}: StatusCardWidgetProps) => {
  const IconSvg = icon;
  const { t } = useTranslation();

  const countCard = useMemo(
    () => ({
      success: statusData.success,
      failed: statusData.failed,
      aborted: statusData.aborted,
    }),
    [statusData]
  );

  const body = (
    <Space
      align="center"
      className="w-full"
      data-testid="status-data-widget"
      direction="vertical"
      size={16}>
      <div className="d-flex items-center gap-2">
        <IconSvg color={PRIMARY_COLOR} height={20} width={20} />
        <Typography.Text
          className="font-medium text-md"
          data-testid="status-title">
          {statusData.title}
        </Typography.Text>
      </div>
      <Typography.Text
        className="font-medium text-xl chart-widget-link-underline"
        data-testid="total-value">
        {statusData.total}
      </Typography.Text>
      <div className="d-flex items-center gap-3">
        {Object.entries(countCard).map(([key, value]) => (
          <Tooltip key={key} title={t(`label.${key}`)}>
            <div
              className={`status-count-container ${key}`}
              data-testid={`${key}-count`}>
              {value}
            </div>
          </Tooltip>
        ))}
      </div>
    </Space>
  );

  return (
    <div
      className={classNames({
        'chart-widget-link-no-underline': !isUndefined(redirectPath),
      })}>
      {redirectPath ? <Link to={redirectPath}>{body}</Link> : body}
    </div>
  );
};

export default StatusDataWidget;
