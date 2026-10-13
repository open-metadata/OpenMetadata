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

import {
  FieldProp,
  FieldTypes,
  FormFields,
  HookForm,
  SimpleModal,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { FunctionComponent, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { User } from '../../../generated/entity/teams/user';
import { showErrorToast } from '../../../utils/ToastUtils';

interface ProfileEditModalProps {
  userData: User;
  onCancel: () => void;
  updateUserDetails: (data: Partial<User>, key: keyof User) => Promise<void>;
}

interface ProfileEditFormValues {
  displayName: string;
}

export const ProfileEditModal: FunctionComponent<ProfileEditModalProps> = ({
  userData,
  onCancel,
  updateUserDetails,
}: ProfileEditModalProps) => {
  const { t } = useTranslation();
  const form = useForm<ProfileEditFormValues>({
    defaultValues: { displayName: userData.displayName ?? '' },
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSaveData = async ({
    displayName,
  }: ProfileEditFormValues): Promise<void> => {
    setIsLoading(true);
    try {
      await updateUserDetails({ displayName }, 'displayName');
      onCancel();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const fields: FieldProp[] = [
    {
      name: 'displayName',
      label: t('label.display-name'),
      type: FieldTypes.TEXT,
      placeholder: t('label.display-name'),
      props: { inputDataTestId: 'displayName-input' },
    },
  ];

  return (
    <SimpleModal
      isOpen
      cancelText={t('label.cancel')}
      data-testid="profile-edit-modal"
      isDismissable={false}
      isOkLoading={isLoading}
      okText={t('label.save')}
      title={t('label.edit-entity', {
        entity: t('label.display-name'),
      })}
      width={500}
      onCancel={onCancel}
      onOk={form.handleSubmit(handleSaveData)}>
      <HookForm
        form={form}
        id="profile-edit-form"
        onSubmit={form.handleSubmit(handleSaveData)}>
        <FormFields fields={fields} />
      </HookForm>
    </SimpleModal>
  );
};
