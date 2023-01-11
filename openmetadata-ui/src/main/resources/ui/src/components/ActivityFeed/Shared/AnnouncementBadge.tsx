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

import React from 'react';
import { useTranslation } from 'react-i18next';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import './Badge.less';

const AnnouncementBadge = () => {
  const { t } = useTranslation();

  return (
    <div className="announcement-badge-container">
      <SVGIcons
        alt="announcement"
        className="announcement-badge"
        icon={Icons.ANNOUNCEMENT_YELLOW}
      />
      <span className="announcement-content">{t('label.announcement')}</span>
    </div>
  );
};

export default AnnouncementBadge;
