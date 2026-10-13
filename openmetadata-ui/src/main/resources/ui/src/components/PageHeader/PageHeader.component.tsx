/*
 *  Copyright 2022 Collate.
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

import { Box, Typography } from '@openmetadata/ui-core-components';
import { Badge } from 'antd';
import { useTranslation } from 'react-i18next';
import { LearningIcon } from '../Learning/LearningIcon/LearningIcon.component';
import './page-header.less';
import { HeaderProps } from './PageHeader.interface';

const PageHeader = ({
  data: { header, subHeader },
  titleProps,
  subHeaderProps,
  isBeta,
  learningPageId,
  title,
}: HeaderProps) => {
  const { t } = useTranslation();

  return (
    <div className="page-header-container" data-testid="page-header-container">
      <Box
        inline
        align="center"
        className="layout-space layout-space-horizontal"
        gap={1}
        itemClassName="layout-space-item">
        <Typography
          as="h5"
          className="heading m-b-0"
          data-testid="heading"
          size="text-md"
          weight="semibold"
          {...titleProps}>
          {header}

          {isBeta && (
            <Badge
              className="service-beta-page-header m-l-sm"
              count={t('label.beta')}
              data-testid="beta-badge"
              size="small"
            />
          )}
        </Typography>
        {learningPageId && (
          <LearningIcon pageId={learningPageId} title={title} />
        )}
      </Box>
      <Typography
        as="p"
        className="sub-heading"
        data-testid="sub-heading"
        {...subHeaderProps}>
        {subHeader}
      </Typography>
    </div>
  );
};

export default PageHeader;
