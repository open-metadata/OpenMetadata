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
  toAnnouncementTypeFields,
  toPlainDescription,
} from './announcementFormUtils';
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
    mode: 'onChange',
    defaultValues: {
      title: announcementTitle,
      description: toPlainDescription(announcement.description),
      type: announcement.type ?? AnnouncementType.Notice,
      color: announcement.color,
      customTypeName: announcement.customTypeName,
      startTime: announcement.startTime,
      endTime: announcement.endTime,
    },
  });

  const handleConfirm = (values: AnnouncementFormValues) => {
    const { title, description, startTime, endTime } = values;

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

    onConfirm(title, {
      ...announcement,
      description,
      startTime,
      endTime,
      ...toAnnouncementTypeFields(values),
    });
  };

  return (
    <AnnouncementForm
      description={t('message.edit-announcement-description')}
      form={form}
      open={open}
      submitLabel={t('label.save')}
      testId="edit-announcement-dialog"
      title={t('label.edit-entity', { entity: t('label.announcement') })}
      onCancel={onCancel}
      onSubmit={handleConfirm}
    />
  );
};

export default EditAnnouncementModal;
