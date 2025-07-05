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
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import './widget-footer.less';

export interface WidgetFooterProps {
  showMoreButton?: boolean;
  moreButtonText?: string;
  onMoreClick?: () => void;
  children?: ReactNode;
  className?: string;
  dataTestId?: string;
}

const WidgetFooter = ({
  showMoreButton = false,
  moreButtonText,
  onMoreClick,
  children,
  className = '',
  dataTestId = 'widget-footer',
}: WidgetFooterProps) => {
  const { t } = useTranslation();

  if (!showMoreButton && !children) {
    return null;
  }

  return (
    <div className={`widget-footer ${className}`} data-testid={dataTestId}>
      {children}
      {showMoreButton && onMoreClick && (
        <div className="p-x-md p-b-md">
          <Button className="w-full" onClick={onMoreClick}>
            <Typography.Text className="text-primary">
              {moreButtonText || t('label.more')}
            </Typography.Text>
          </Button>
        </div>
      )}
    </div>
  );
};

export default WidgetFooter;
