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
import { MoreOutlined } from '@ant-design/icons';
import { Button, Dropdown, Space, Typography } from 'antd';
import { compare } from 'fast-json-patch';
import { isEmpty } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AnnouncementEntity } from '../../rest/announcementsAPI';
import { formatDateTime } from '../../utils/date-time/DateTimeUtils';
import entityUtilClassBase from '../../utils/EntityUtilClassBase';
import { getEntityFQN, getEntityType } from '../../utils/FeedUtils';
import RichTextEditorPreviewerV1 from '../common/RichTextEditor/RichTextEditorPreviewerV1';
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
  const entityType = getEntityType(announcement.entityLink ?? '');
  const entityFQN = getEntityFQN(announcement.entityLink ?? '');
  const announcementTitle = announcement.displayName ?? announcement.name;
  const details = {
    description: announcement.description,
    startTime: announcement.startTime,
    endTime: announcement.endTime,
  };

  const entityLink = useMemo(() => {
    if (!entityType || !entityFQN) {
      return '';
    }

    return entityUtilClassBase.getEntityLink(entityType, entityFQN);
  }, [entityFQN, entityType]);

  const dropdownItems = useMemo(
    () =>
      editPermission
        ? [
            {
              key: 'edit',
              label: (
                <span data-testid="announcement-edit-action">
                  {t('label.edit')}
                </span>
              ),
              onClick: () => setIsEditAnnouncement(true),
            },
            {
              key: 'delete',
              label: (
                <span data-testid="announcement-delete-action">
                  {t('label.delete')}
                </span>
              ),
              danger: true,
              onClick: () =>
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
    updatedDetails: Pick<
      AnnouncementEntity,
      'description' | 'startTime' | 'endTime'
    >
  ) => {
    const normalizedDisplayName =
      title === announcement.name ? undefined : title.trim();
    const patch = compare(
      {
        displayName: announcement.displayName,
        description: announcement.description,
        startTime: announcement.startTime,
        endTime: announcement.endTime,
      },
      {
        displayName: normalizedDisplayName,
        description: updatedDetails.description,
        startTime: updatedDetails.startTime,
        endTime: updatedDetails.endTime,
      }
    );

    if (!isEmpty(patch)) {
      await updateAnnouncementHandler(announcement.id, patch);
    }
    setIsEditAnnouncement(false);
  };

  return (
    <div
      className="bg-grey-1-hover m--x-sm w-full p-x-sm m--t-xss py-2 m-b-xss rounded-4"
      data-testid="main-message">
      <div className="d-flex justify-between gap-4">
        <div className="d-flex flex-column gap-2 flex-1">
          <Typography.Text className="text-base font-medium">
            {announcementTitle}
          </Typography.Text>
          <Space wrap size={8}>
            {announcement.createdBy && (
              <Typography.Text className="text-grey-muted text-xs">
                {t('label.by-entity', { entity: announcement.createdBy })}
              </Typography.Text>
            )}
            <Typography.Text className="text-grey-muted text-xs">
              {formatDateTime(announcement.updatedAt ?? announcement.createdAt)}
            </Typography.Text>
            {entityType && entityFQN && (
              <Typography.Text className="text-grey-muted text-xs">
                {entityLink ? (
                  <Link to={entityLink}>{entityFQN.split('.').pop()}</Link>
                ) : (
                  entityFQN.split('.').pop()
                )}
              </Typography.Text>
            )}
          </Space>
        </div>
        {dropdownItems.length > 0 && (
          <Dropdown menu={{ items: dropdownItems }} trigger={['click']}>
            <Button
              data-testid="announcement-actions"
              icon={<MoreOutlined />}
              type="text"
            />
          </Dropdown>
        )}
      </div>

      {details.description && (
        <RichTextEditorPreviewerV1
          className="m-t-sm"
          data-testid="announcement-description"
          markdown={details.description}
        />
      )}

      <Space wrap className="m-t-sm" size={16}>
        <Typography.Text className="text-grey-muted text-xs">
          {`${t('label.start-date')}: ${formatDateTime(details.startTime)}`}
        </Typography.Text>
        <Typography.Text className="text-grey-muted text-xs">
          {`${t('label.end-date')}: ${formatDateTime(details.endTime)}`}
        </Typography.Text>
      </Space>

      {isEditAnnouncement && (
        <EditAnnouncementModal
          announcement={details}
          announcementTitle={announcementTitle}
          open={isEditAnnouncement}
          onCancel={() => setIsEditAnnouncement(false)}
          onConfirm={handleAnnouncementUpdate}
        />
      )}
    </div>
  );
};

export default AnnouncementFeedCardBody;
