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
import { Card, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { DataStatisticWidgetProps } from '../../DataQuality.interface';
import './data-statistic-widget.less';

const DataStatisticWidget = ({
  name,
  title,
  icon,
  dataLabel,
  countValue,
  redirectPath,
  linkLabel,
  isLoading,
  iconProps,
}: DataStatisticWidgetProps) => {
  const Icon = icon;

  return (
    <Card
      className="h-full"
      data-testid={`${name}-data-statistic-widget`}
      loading={isLoading}>
      <Typography.Paragraph className="text-xs font-semibold data-statistic-widget-title">
        {title}
      </Typography.Paragraph>

      <div className="d-flex gap-2 items-center m-b-xss">
        <Icon height={24} width={24} {...iconProps} />
        <Typography.Paragraph
          className="font-medium text-md m-b-0"
          data-testid="total-value">
          {`${countValue} ${dataLabel}`}
        </Typography.Paragraph>
      </div>
      <Typography.Paragraph>
        <Link to={redirectPath}>{linkLabel}</Link>
      </Typography.Paragraph>
    </Card>
  );
};

export default DataStatisticWidget;
