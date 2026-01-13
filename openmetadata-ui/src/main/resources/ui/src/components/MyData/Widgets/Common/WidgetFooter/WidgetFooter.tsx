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

import { ArrowRightOutlined } from '@ant-design/icons';
import { Button, Divider, Row } from 'antd';
import { useTranslation } from 'react-i18next';
import './widget-footer.less';

export interface WidgetFooterProps {
  className?: string;
  moreButtonLink?: string;
  moreButtonText?: string;
  onMoreClick?: () => void;
  showMoreButton?: boolean;
}

const WidgetFooter = ({
  className = '',
  moreButtonLink,
  moreButtonText,
  onMoreClick,
  showMoreButton = false,
}: WidgetFooterProps) => {
  const { t } = useTranslation();
  if (!showMoreButton) {
    return null;
  }

  return (
    <div className={`widget-footer ${className}`} data-testid="widget-footer">
      {showMoreButton && (onMoreClick || moreButtonLink) && (
        <Row className="widget-footer">
          <Divider className="mb-0 mt-0" />
          <Button
            className="text-primary hover:underline w-full footer-view-more-button"
            href={moreButtonLink}
            type="link">
            {moreButtonText || t('label.view-more')}
            <ArrowRightOutlined data-testid="arrow-right-icon" />
          </Button>
        </Row>
      )}
    </div>
  );
};

export default WidgetFooter;
