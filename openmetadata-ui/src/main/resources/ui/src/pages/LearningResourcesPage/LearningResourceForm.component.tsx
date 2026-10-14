/*
 *  Copyright 2024 Collate.
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
  Button,
  getField,
  HookForm,
  Typography,
} from '@openmetadata/ui-core-components';
import { Drawer } from 'antd';
import { AxiosError } from 'axios';
import React, { Fragment, useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  LearningResourceFormValues,
  toLearningResourceFormValues,
  toLearningResourcePayload,
} from '../../components/discovery/personal-space/Profile/tabs/platform-settings/LearningResourceSettings.utils';
import { useLearningResourceFields } from '../../components/discovery/personal-space/Profile/tabs/platform-settings/useLearningResourceFields';
import {
  createLearningResource,
  updateLearningResource,
} from '../../rest/learningResourceAPI';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import './learning-resource-form.less';
import { LearningResourceFormProps } from './LearningResourceForm.interface';
import { XClose } from '@openmetadata/ui-core-components/icons';

export const LearningResourceForm: React.FC<LearningResourceFormProps> = ({
  open,
  resource,
  onClose,
}) => {
  const { t } = useTranslation();
  const form = useForm<LearningResourceFormValues>({
    defaultValues: toLearningResourceFormValues(),
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const resourceType = useWatch({
    control: form.control,
    name: 'resourceType',
  });
  const fields = useLearningResourceFields(Boolean(resource), resourceType);

  useEffect(() => {
    form.reset(toLearningResourceFormValues(resource ?? undefined));
  }, [resource, open, form]);

  const handleSubmit = async (values: LearningResourceFormValues) => {
    setIsSubmitting(true);
    try {
      const payload = toLearningResourcePayload(values, resource ?? undefined);
      if (resource) {
        await updateLearningResource(payload);
      } else {
        await createLearningResource(payload);
      }
      showSuccessToast(
        t(
          resource
            ? 'server.entity-updated-success'
            : 'server.create-entity-success',
          { entity: t('label.learning-resource') }
        )
      );
      onClose();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const drawerTitle = (
    <div className="drawer-title-container">
      <Typography className="drawer-title">
        {resource ? t('label.edit-resource') : t('label.add-resource')}
      </Typography>
      <XClose className="drawer-close" onClick={onClose} />
    </div>
  );

  const drawerFooter = (
    <div className="drawer-footer">
      <Button color="secondary" data-testid="cancel-resource" onClick={onClose}>
        {t('label.cancel')}
      </Button>
      <Button
        color="primary"
        data-testid="save-resource"
        isLoading={isSubmitting}
        onClick={form.handleSubmit(handleSubmit)}>
        {t('label.save')}
      </Button>
    </div>
  );

  return (
    <Drawer
      destroyOnClose
      className="learning-resource-form-drawer"
      closable={false}
      data-testid="learning-resource-form-drawer"
      footer={drawerFooter}
      // A core Select closes on pointerup, so the click lands on the mask.
      maskClosable={false}
      open={open}
      placement="right"
      title={drawerTitle}
      width={600}
      onClose={onClose}>
      <HookForm
        className="learning-resource-form tw:flex tw:flex-col tw:gap-4"
        form={form}
        onSubmit={form.handleSubmit(handleSubmit)}>
        {fields.map((field) => (
          <Fragment key={field.name}>{getField(field)}</Fragment>
        ))}
      </HookForm>
    </Drawer>
  );
};
