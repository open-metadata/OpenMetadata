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

import { Button, Typography } from 'antd';
import { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../../enums/common.enum';
import ErrorPlaceHolder from '../../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import './widget-empty-state.less';

export interface WidgetEmptyStateProps {
  icon?: ReactElement;
  title?: string;
  description?: string;
  showActionButton?: boolean;
  actionButtonText?: string;
  actionButtonLink?: string;
  onActionClick?: () => void;
  className?: string;
  dataTestId?: string;
}

const WidgetEmptyState = ({
  icon,
  title,
  description,
  showActionButton = false,
  actionButtonText,
  actionButtonLink,
  onActionClick,
  className = '',
  dataTestId = 'widget-empty-state',
}: WidgetEmptyStateProps) => {
  const { t } = useTranslation();

  const handleActionClick = () => {
    if (onActionClick) {
      onActionClick();
    }
  };

  const actionButton = showActionButton && (
    <Button className="m-t-md" type="primary" onClick={handleActionClick}>
      {actionButtonText || t('label.explore')}
    </Button>
  );

  const actionLink = actionButtonLink && (
    <Link to={actionButtonLink}>
      <Button className="m-t-md" type="primary">
        {actionButtonText || t('label.explore')}
      </Button>
    </Link>
  );

  return (
    <div className={`widget-empty-state ${className}`} data-testid={dataTestId}>
      <ErrorPlaceHolder
        className="border-none"
        icon={icon}
        type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
        <div className="d-flex flex-col items-center">
          {title && (
            <Typography.Text className="text-md font-semibold m-b-sm">
              {title}
            </Typography.Text>
          )}
          {description && (
            <Typography.Text className="placeholder-text text-sm font-regular">
              {description}
            </Typography.Text>
          )}
          {actionButton}
          {actionLink}
        </div>
      </ErrorPlaceHolder>
    </div>
  );
};

export default WidgetEmptyState;
