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

import Icon from '@ant-design/icons/lib/components/Icon';
import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import AnnouncementIcon from '../../../assets/svg/announcements-v1.svg?react';
import './task-badge.less';

const AnnouncementBadge = () => {
  const { t } = useTranslation();

  return (
    <div className="announcement-badge-container">
      <Icon className="announcement-badge" component={AnnouncementIcon} />

      <Typography.Text className="announcement-text">
        {t('label.announcement')}
      </Typography.Text>
    </div>
  );
};

export default AnnouncementBadge;
