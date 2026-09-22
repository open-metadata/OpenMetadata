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

import { FC } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { AnnouncementType } from '../../../generated/entity/feed/announcement';
import { showErrorToast } from '../../../utils/ToastUtils';
import AnnouncementForm from './AnnouncementForm.component';
import {
  AnnouncementFormValues,
  EditableAnnouncement,
} from './AnnouncementModal.interface';

interface Props {
  announcement: EditableAnnouncement;
  announcementTitle: string;
  open: boolean;
  onCancel: () => void;
  onConfirm: (title: string, announcement: EditableAnnouncement) => void;
}

const EditAnnouncementModal: FC<Props> = ({
  open,
  onCancel,
  onConfirm,
  announcementTitle,
  announcement,
}) => {
  const { t } = useTranslation();

  const form = useForm<AnnouncementFormValues>({
    defaultValues: {
      title: announcementTitle,
      description: announcement.description,
      announcementType:
        announcement.announcementType ?? AnnouncementType.Notice,
      color: announcement.color,
      startTime: announcement.startTime,
      endTime: announcement.endTime,
    },
  });

  const handleConfirm = ({
    title,
    description,
    startTime,
    endTime,
    announcementType,
    color,
  }: AnnouncementFormValues) => {
    const startTimeMs = startTime;
    const endTimeMs = endTime;

    if (startTimeMs >= endTimeMs) {
      showErrorToast(t('message.announcement-invalid-start-time'));

      return;
    }

    onConfirm(title, {
      ...announcement,
      description,
      startTime: startTimeMs,
      endTime: endTimeMs,
      announcementType,
      color: announcementType === AnnouncementType.Custom ? color : undefined,
    });
  };

  return (
    <AnnouncementForm
      form={form}
      open={open}
      submitLabel={t('label.save')}
      testId="edit-announcement"
      title={t('label.edit-an-announcement')}
      onCancel={onCancel}
      onSubmit={handleConfirm}
    />
  );
};

export default EditAnnouncementModal;
