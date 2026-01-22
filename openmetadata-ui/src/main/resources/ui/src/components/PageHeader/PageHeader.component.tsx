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

import { Badge, Space, Typography } from 'antd';
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
      <Space align="center" size={4}>
        <Typography.Title
          className="heading m-b-0"
          data-testid="heading"
          level={5}
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
        </Typography.Title>
        {learningPageId && (
          <LearningIcon pageId={learningPageId} title={title} />
        )}
      </Space>
      <Typography.Paragraph
        className="sub-heading"
        data-testid="sub-heading"
        {...subHeaderProps}>
        {subHeader}
      </Typography.Paragraph>
    </div>
  );
};

export default PageHeader;
