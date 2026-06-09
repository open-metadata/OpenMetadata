/*
 *  Copyright 2026 Collate.
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

import { Typography } from '@openmetadata/ui-core-components';
import { ArrowRight } from '@untitledui/icons';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useUserProfile } from '../../../hooks/user-profile/useUserProfile';
import { AnnouncementEntity } from '../../../rest/announcementsAPI';
import { isDescriptionContentEmpty } from '../../../utils/BlockEditorUtils';
import { getShortRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getUserPath } from '../../../utils/RouterUtils';
import ProfilePicture from '../ProfilePicture/ProfilePicture';
import RichTextEditorPreviewerV1 from '../RichTextEditor/RichTextEditorPreviewerV1';

interface AnnouncementItemV3Props {
  announcement: AnnouncementEntity;
  onClick: () => void;
}

const AnnouncementItemV3 = ({
  announcement,
  onClick,
}: AnnouncementItemV3Props) => {
  const { t } = useTranslation();
  const createdBy = announcement.createdBy;
  const [, , user] = useUserProfile({
    permission: true,
    name: createdBy ?? '',
  });

  const title = announcement.displayName ?? announcement.name;
  const postedBy = getEntityName(user) || createdBy;
  const timestamp = announcement.createdAt ?? announcement.updatedAt;

  return (
    <div
      className="tw:flex tw:cursor-pointer tw:flex-col tw:gap-[9px] tw:pl-[3px]"
      data-testid={`announcement-item-${announcement.id}`}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (
          e.target === e.currentTarget &&
          (e.key === 'Enter' || e.key === ' ')
        ) {
          e.preventDefault();
          onClick();
        }
      }}>
      <div className="tw:flex tw:items-center tw:gap-[9px]">
        <span className="tw:h-[35px] tw:w-1 tw:shrink-0 tw:rounded-[1px] tw:bg-utility-blue-dark-500" />

        <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-1.5">
          <Typography
            ellipsis
            as="span"
            className="tw:text-text-primary"
            size="text-sm"
            weight="semibold">
            {title}
          </Typography>
          {!isDescriptionContentEmpty(announcement.description) && (
            <RichTextEditorPreviewerV1
              className="tw:[&_p]:text-text-secondary tw:[&_p]:text-xs"
              enableSeeMoreVariant={false}
              markdown={announcement.description}
              reducePreviewLineClass="max-one-line"
              showReadMoreBtn={false}
            />
          )}
        </div>

        <ArrowRight className="tw:size-4 tw:shrink-0 tw:text-fg-brand-primary" />
      </div>

      {createdBy && (
        <div className="tw:flex tw:items-center tw:gap-1.5">
          <ProfilePicture
            displayName={postedBy}
            name={createdBy}
            type="circle"
            width="14"
          />
          <span className="tw:text-xs tw:text-text-secondary">
            {t('label.posted-by')}{' '}
            <Link
              className="tw:text-fg-brand-primary"
              to={getUserPath(createdBy)}
              onClick={(e) => e.stopPropagation()}>
              {postedBy}
            </Link>
          </span>
          <span className="tw:text-xs tw:text-text-secondary">
            {getShortRelativeTime(timestamp)}
          </span>
        </div>
      )}
    </div>
  );
};

export default AnnouncementItemV3;
