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

import { ArrowRightOutlined } from '@ant-design/icons';
import { Badge, Button, Popover } from 'antd';
import classNames from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as LearningIconSvg } from '../../../assets/svg/ic-learning.svg';
import { getLearningResourcesByContext } from '../../../rest/learningResourceAPI';
import { LearningDrawer } from '../LearningDrawer/LearningDrawer.component';
import './learning-icon.less';
import { LearningIconProps } from './LearningIcon.interface';

export const LearningIcon: React.FC<LearningIconProps> = ({
  pageId,
  title,
  className = '',
}) => {
  const { t } = useTranslation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [resourceCount, setResourceCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const fetchResourceCount = useCallback(async () => {
    if (resourceCount > 0 || hasError) {
      return;
    }
    setIsLoading(true);
    try {
      const response = await getLearningResourcesByContext(pageId, {
        limit: 1,
      });
      setResourceCount(response.paging?.total ?? 0);
    } catch {
      setHasError(true);
      setResourceCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [pageId, resourceCount, hasError]);

  useEffect(() => {
    fetchResourceCount();
  }, []);

  const handleClick = useCallback(() => {
    setDrawerOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  if (hasError || (resourceCount === 0 && !isLoading)) {
    return null;
  }

  const popoverContent = (
    <div className="learning-tooltip-content">
      <span className="learning-tooltip-text">
        {t('label.learn-how-this-feature-works')}
      </span>
      <Button
        className="learning-tooltip-button"
        size="small"
        type="default"
        onClick={handleClick}>
        {resourceCount} {t('label.resource-plural').toLowerCase()}{' '}
        <ArrowRightOutlined />
      </Button>
    </div>
  );

  return (
    <>
      <Popover
        content={popoverContent}
        overlayClassName="learning-tooltip-popover"
        placement="bottom"
        trigger="hover">
        <Badge
          className={classNames('learning-icon-badge', className)}
          count={resourceCount}
          offset={[8, -4]}
          size="small">
          <div
            className="learning-icon-container"
            data-testid="learning-icon"
            onClick={handleClick}>
            <LearningIconSvg height={16} width={16} />
          </div>
        </Badge>
      </Popover>

      <LearningDrawer
        open={drawerOpen}
        pageId={pageId}
        title={title}
        onClose={handleClose}
      />
    </>
  );
};
