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
import {
  Badge,
  Box,
  Dropdown,
  Typography,
} from '@openmetadata/ui-core-components';
import { Calendar } from '@untitledui/icons';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { isEmpty } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ANNOUNCEMENT_STATUS_CLASSES,
  ANNOUNCEMENT_STATUS_LABEL_KEYS,
  ANNOUNCEMENT_SURFACE_CLASSES,
  getAnnouncementStatus,
  getAnnouncementTypeConfig,
} from '../../utils/AnnouncementsUtils';
import { formatDate } from '../../utils/date-time/DateTimeUtils';
import ProfilePicture from '../common/ProfilePicture/ProfilePicture';
import RichTextEditorPreviewerV1 from '../common/RichTextEditor/RichTextEditorPreviewerV1';
import { EditableAnnouncement } from '../Modals/AnnouncementModal/AnnouncementModal.interface';
import EditAnnouncementModal from '../Modals/AnnouncementModal/EditAnnouncementModal';
import { AnnouncementFeedCardBodyProp } from './Announcement.interface';

const AnnouncementFeedCardBody = ({
  announcement,
  editPermission,
  onConfirmation,
  updateAnnouncementHandler,
}: AnnouncementFeedCardBodyProp) => {
  const { t } = useTranslation();
  const [isEditAnnouncement, setIsEditAnnouncement] = useState(false);

  const announcementTitle = announcement.displayName ?? announcement.name;
  const {
    color,
    icon: TypeIcon,
    labelKey,
  } = getAnnouncementTypeConfig(announcement);
  const status = getAnnouncementStatus(announcement);

  const details: EditableAnnouncement = {
    description: announcement.description,
    startTime: announcement.startTime,
    endTime: announcement.endTime,
    announcementType: announcement.announcementType,
    color: announcement.color,
  };

  const dropdownItems = useMemo(
    () =>
      editPermission
        ? [
            {
              id: 'edit',
              label: t('label.edit'),
              testId: 'announcement-edit-action',
              onAction: () => setIsEditAnnouncement(true),
            },
            {
              id: 'delete',
              label: t('label.delete'),
              testId: 'announcement-delete-action',
              onAction: () =>
                onConfirmation({
                  state: true,
                  threadId: announcement.id,
                  postId: announcement.id,
                  isThread: true,
                }),
            },
          ]
        : [],
    [announcement.id, editPermission, onConfirmation, t]
  );

  const handleAnnouncementUpdate = async (
    title: string,
    updatedDetails: EditableAnnouncement
  ) => {
    const normalizedDisplayName =
      title === announcement.name ? undefined : title.trim();
    const patch = compare(
      {
        displayName: announcement.displayName,
        description: announcement.description,
        startTime: announcement.startTime,
        endTime: announcement.endTime,
        announcementType: announcement.announcementType,
        color: announcement.color,
      },
      {
        displayName: normalizedDisplayName,
        description: updatedDetails.description,
        startTime: updatedDetails.startTime,
        endTime: updatedDetails.endTime,
        announcementType: updatedDetails.announcementType,
        color: updatedDetails.color,
      }
    );

    if (!isEmpty(patch)) {
      await updateAnnouncementHandler(announcement.id, patch);
    }
    setIsEditAnnouncement(false);
  };

  return (
    <Box className="tw:gap-3" data-testid="main-message" direction="col">
      <Box align="center" className="tw:gap-2" justify="between">
        <Box align="center" className="tw:min-w-0 tw:gap-2">
          <span
            className={classNames(
              'tw:flex tw:size-7 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:border tw:bg-primary',
              ANNOUNCEMENT_SURFACE_CLASSES[color].border
            )}>
            <TypeIcon
              className={classNames(
                'tw:size-4',
                ANNOUNCEMENT_SURFACE_CLASSES[color].icon
              )}
            />
          </span>
          <Badge
            className="tw:bg-primary!"
            color={color}
            data-testid="announcement-type-badge"
            size="sm"
            type="color">
            {t(labelKey)}
          </Badge>
        </Box>

        <Box align="center" className="tw:shrink-0 tw:gap-1">
          <Typography
            as="span"
            className={ANNOUNCEMENT_STATUS_CLASSES[status]}
            data-testid="announcement-status"
            size="text-xs"
            weight="medium">
            {t(ANNOUNCEMENT_STATUS_LABEL_KEYS[status])}
          </Typography>
          {dropdownItems.length > 0 && (
            <Dropdown.Root>
              <Dropdown.DotsButton data-testid="announcement-actions" />
              <Dropdown.Popover className="tw:w-max">
                <Dropdown.Menu items={dropdownItems}>
                  {(item: {
                    id: string;
                    label: string;
                    testId: string;
                    onAction: () => void;
                  }) => (
                    <Dropdown.Item
                      data-testid={item.testId}
                      id={item.id}
                      label={item.label}
                      onAction={item.onAction}
                    />
                  )}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown.Root>
          )}
        </Box>
      </Box>

      <Typography
        as="span"
        className="tw:text-primary"
        size="text-sm"
        weight="semibold">
        {announcementTitle}
      </Typography>

      {details.description && (
        <RichTextEditorPreviewerV1
          className="tw:[&_p]:text-secondary tw:[&_p]:text-xs"
          data-testid="announcement-description"
          enableSeeMoreVariant={false}
          markdown={details.description}
          reducePreviewLineClass="max-two-lines"
          showReadMoreBtn={false}
        />
      )}

      <Box align="center" className="tw:gap-2">
        {announcement.createdBy && (
          <>
            <ProfilePicture name={announcement.createdBy} width="16" />
            <Typography as="span" className="tw:text-secondary" size="text-xs">
              {announcement.createdBy}
            </Typography>
            <span className="tw:text-border-secondary">|</span>
          </>
        )}
        <Calendar className="tw:size-3.5 tw:shrink-0 tw:text-tertiary" />
        <Typography
          as="span"
          className="tw:text-secondary"
          data-testid="announcement-date-range"
          size="text-xs">
          {`${formatDate(details.startTime)} - ${formatDate(details.endTime)}`}
        </Typography>
      </Box>

      {isEditAnnouncement && (
        <EditAnnouncementModal
          announcement={details}
          announcementTitle={announcementTitle}
          open={isEditAnnouncement}
          onCancel={() => setIsEditAnnouncement(false)}
          onConfirm={handleAnnouncementUpdate}
        />
      )}
    </Box>
  );
};

export default AnnouncementFeedCardBody;
