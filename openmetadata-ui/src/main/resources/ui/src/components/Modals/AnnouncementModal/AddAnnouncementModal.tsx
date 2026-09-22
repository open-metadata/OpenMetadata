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

import { AxiosError } from 'axios';
import { FC, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { AnnouncementType } from '../../../generated/entity/feed/announcement';
import { createAnnouncement } from '../../../rest/announcementsAPI';
import { getEntityFeedLink } from '../../../utils/EntityPureUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import AnnouncementForm from './AnnouncementForm.component';
import { AnnouncementFormValues } from './AnnouncementModal.interface';

const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;

interface Props {
  open: boolean;
  entityType: string;
  entityFQN: string;
  onCancel: () => void;
  onSave: () => void;
}

const AddAnnouncementModal: FC<Props> = ({
  open,
  onCancel,
  onSave,
  entityType,
  entityFQN,
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { t } = useTranslation();

  const form = useForm<AnnouncementFormValues>({
    defaultValues: {
      title: '',
      description: '',
      announcementType: AnnouncementType.Notice,
      startTime: Date.now(),
      // A day's window by default: an end equal to the start fails the
      // start-before-end check, so the first submit would always toast.
      endTime: Date.now() + DEFAULT_WINDOW_MS,
    },
  });

  const handleCreateAnnouncement = async ({
    title,
    startTime,
    endTime,
    description,
    announcementType,
    color,
  }: AnnouncementFormValues) => {
    const startTimeMs = startTime;
    const endTimeMs = endTime;

    if (startTimeMs >= endTimeMs) {
      showErrorToast(t('message.announcement-invalid-start-time'));

      return;
    }

    try {
      setIsLoading(true);
      const data = await createAnnouncement({
        displayName: title,
        description,
        entityLink: getEntityFeedLink(entityType, entityFQN),
        startTime: startTimeMs,
        endTime: endTimeMs,
        announcementType,
        color: announcementType === AnnouncementType.Custom ? color : undefined,
      });
      if (data) {
        showSuccessToast(t('message.announcement-created-successfully'));
      }
      onSave();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnnouncementForm
      form={form}
      isSaving={isLoading}
      open={open}
      submitLabel={t('label.submit')}
      testId="add-announcement"
      title={t('message.make-an-announcement')}
      onCancel={onCancel}
      onSubmit={handleCreateAnnouncement}
    />
  );
};

export default AddAnnouncementModal;
