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
import {
  Button,
  Divider,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { Link } from 'react-router-dom';
import { ReactComponent as RightArrowIcon } from '../../../../assets/svg/line-arrow-right.svg';
import { DataStatisticWidgetProps } from '../../DataQuality.interface';
import './data-statistic-widget.less';

const DataStatisticWidget = ({
  className,
  countValue,
  countValueClassName,
  dataLabel,
  footer,
  icon,
  iconProps,
  isLoading,
  linkLabel,
  name,
  redirectPath,
  styleType,
  title,
  titleClassName,
}: DataStatisticWidgetProps) => {
  const Icon = icon;

  if (isLoading) {
    return <Skeleton height={200} width="100%" />;
  }

  const defaultFooter =
    redirectPath && linkLabel && !footer ? (
      <Link to={redirectPath}>
        <Button
          className="data-statistic-widget-default-button"
          color="link-color"
          iconTrailing={<RightArrowIcon />}>
          {linkLabel}
        </Button>
      </Link>
    ) : null;

  const renderFooter = footer || defaultFooter;

  return (
    <div
      className={classNames('data-statistic-widget-box', className)}
      data-testid={`${name}-data-statistic-widget`}>
      <div className="tw:flex tw:gap-4 tw:items-center tw:mb-1">
        <div className={classNames('data-statistic-widget-icon', styleType)}>
          <Icon {...iconProps} />
        </div>
        <div className="data-statistic-widget-title">
          <Typography
            as="h4"
            className={classNames(
              'data-statistic-title-default',
              titleClassName
            )}>
            {title}
          </Typography>
          <Typography
            as="p"
            className={classNames(
              'data-statistic-count-default',
              countValueClassName
            )}
            data-testid="total-value">
            {dataLabel ? `${countValue} ${dataLabel}` : countValue}
          </Typography>
        </div>
      </div>
      {renderFooter && (
        <>
          <Divider className="data-statistic-widget-divider" />
          <div className="data-statistic-widget-footer">{renderFooter}</div>
        </>
      )}
    </div>
  );
};

export default DataStatisticWidget;
