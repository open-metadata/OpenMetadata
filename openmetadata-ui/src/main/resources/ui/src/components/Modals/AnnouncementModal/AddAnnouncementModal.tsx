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
import { toAnnouncementTypeFields } from './announcementFormUtils';
import { AnnouncementFormValues } from './AnnouncementModal.interface';

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
    // `onChange` so `formState.isValid` — which gates the submit button —
    // tracks the fields as they are filled instead of only after a submit.
    mode: 'onChange',
    defaultValues: {
      title: '',
      description: '',
      type: AnnouncementType.Notice,
      // Dates start empty: a prefilled window is a schedule the author never
      // chose, and it reads as already-decided.
      startTime: null,
      endTime: null,
    },
  });

  const handleCreateAnnouncement = async (values: AnnouncementFormValues) => {
    const { title, startTime, endTime, description } = values;

    // The `required` rules gate submit, so both dates are set by the time this
    // runs; the guard is what narrows the form's optional type to the `number`
    // the API takes.
    if (startTime == null || endTime == null) {
      return;
    }

    if (startTime >= endTime) {
      showErrorToast(t('message.announcement-invalid-start-time'));

      return;
    }

    try {
      setIsLoading(true);
      const data = await createAnnouncement({
        displayName: title,
        description,
        entityLink: getEntityFeedLink(entityType, entityFQN),
        startTime,
        endTime,
        ...toAnnouncementTypeFields(values),
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
      description={t('message.add-announcement-description')}
      form={form}
      isSaving={isLoading}
      open={open}
      submitLabel={t('label.add-entity', { entity: t('label.announcement') })}
      testId="add-announcement-dialog"
      title={t('label.add-entity', { entity: t('label.announcement') })}
      onCancel={onCancel}
      onSubmit={handleCreateAnnouncement}
    />
  );
};

export default AddAnnouncementModal;
