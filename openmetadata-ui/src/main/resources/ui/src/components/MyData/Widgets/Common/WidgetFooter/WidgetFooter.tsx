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

import { Button, Divider } from '@openmetadata/ui-core-components';
import { ArrowRight } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
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
    <div
      className={classNames('widget-footer', className)}
      data-testid="widget-footer">
      {(onMoreClick || moreButtonLink) && (
        <>
          <Divider />
          <Button
            className="footer-view-more-button tw:my-2 tw:h-10 tw:w-full tw:justify-center tw:font-normal"
            color="link-color"
            href={moreButtonLink}
            iconTrailing={
              <ArrowRight
                className="tw:size-4"
                data-icon="trailing"
                data-testid="arrow-right-icon"
              />
            }
            onPress={onMoreClick}>
            {moreButtonText || t('label.view-more')}
          </Button>
        </>
      )}
    </div>
  );
};

export default WidgetFooter;
