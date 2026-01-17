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

import { RightOutlined } from '@ant-design/icons';
import { Badge, Popover, Typography } from 'antd';
import classNames from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as LearningIconSvg } from '../../../assets/svg/ic-learning.svg';
import { getLearningResourcesByContext } from '../../../rest/learningResourceAPI';
import { LearningDrawer } from '../LearningDrawer/LearningDrawer.component';
import { LearningIconProps } from './LearningIcon.interface';
import './LearningIcon.less';

const { Text } = Typography;

export const LearningIcon: React.FC<LearningIconProps> = ({
  pageId,
  title,
  className = '',
}) => {
  const { t } = useTranslation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [resourceCount, setResourceCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [popoverVisible, setPopoverVisible] = useState(false);

  const fetchResourceCount = useCallback(async () => {
    if (resourceCount > 0 || isLoading) {
      return;
    }
    setIsLoading(true);
    try {
      const response = await getLearningResourcesByContext(pageId, {
        limit: 1,
      });
      setResourceCount(response.paging?.total ?? 0);
    } catch {
      setResourceCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [pageId, resourceCount, isLoading]);

  useEffect(() => {
    fetchResourceCount();
  }, []);

  const handleClick = useCallback(() => {
    setPopoverVisible(false);
    setDrawerOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const handlePopoverVisibleChange = useCallback((visible: boolean) => {
    setPopoverVisible(visible);
  }, []);

  const popoverContent = (
    <div className="learning-icon-popover" onClick={handleClick}>
      <Text className="popover-text">
        {t('label.learn-how-this-feature-works')}
      </Text>
      <div className="popover-action">
        <Text className="resource-count">
          {resourceCount} {t('label.resource-plural')}
        </Text>
        <RightOutlined className="arrow-icon" />
      </div>
    </div>
  );

  if (resourceCount === 0 && !isLoading) {
    return null;
  }

  return (
    <>
      <Popover
        content={popoverContent}
        open={popoverVisible}
        placement="bottomLeft"
        trigger="hover"
        onOpenChange={handlePopoverVisibleChange}>
        <Badge
          className={classNames('learning-icon-badge', className)}
          count={resourceCount}
          offset={[-4, 4]}
          size="small">
          <div
            className="learning-icon-container"
            data-testid={`learning-icon-${pageId}`}>
            <LearningIconSvg className="learning-icon-svg" />
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
