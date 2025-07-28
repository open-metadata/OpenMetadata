/*
 *  Copyright 2023 Collate.
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

import Form, { FormProps, IChangeEvent } from '@rjsf/core';
import { ValidatorType } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { Modal } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../../enums/entity.enum';
import {
  DatabaseProfilerConfig as ProfilerConfig,
  ProfileSampleType,
} from '../../../../generated/entity/data/database';
import profilerSettingsSchema from '../../../../jsons/profilerSettings.json';
import {
  getDatabaseProfilerConfig,
  getDatabaseSchemaProfilerConfig,
  putDatabaseProfileConfig,
  putDatabaseSchemaProfileConfig,
} from '../../../../rest/databaseAPI';
import { transformErrors } from '../../../../utils/formUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import BooleanFieldTemplate from '../../../common/Form/JSONSchema/JSONSchemaTemplate/BooleanFieldTemplate';
import DescriptionFieldTemplate from '../../../common/Form/JSONSchema/JSONSchemaTemplate/DescriptionFieldTemplate';
import { FieldErrorTemplate } from '../../../common/Form/JSONSchema/JSONSchemaTemplate/FieldErrorTemplate/FieldErrorTemplate';
import Loader from '../../../common/Loader/Loader';
import { CustomRangeWidget } from './CustomRangeWidget';
import './profiler-settings.less';
import { ProfilerObjectFieldTemplate } from './ProfilerObjectFieldTemplate';

export interface ProfilerSettingsProps {
  entityId: string;
  entityType: EntityType.DATABASE | EntityType.DATABASE_SCHEMA;
  visible: boolean;
  onVisibilityChange: (value: boolean) => void;
}

const ProfilerSettings: FC<ProfilerSettingsProps> = ({
  entityId,
  entityType,
  visible,
  onVisibilityChange,
}) => {
  const { t } = useTranslation();
  const [profilerConfig, setProfilerConfig] = useState<ProfilerConfig>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const fetchProfilerConfig = async () => {
    const api =
      entityType === EntityType.DATABASE
        ? getDatabaseProfilerConfig
        : getDatabaseSchemaProfilerConfig;
    try {
      setIsLoading(true);
      const config = await api(entityId);
      setProfilerConfig(config);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async (e: IChangeEvent<ProfilerConfig>) => {
    if (!e.formData) {
      return;
    }

    const api =
      entityType === EntityType.DATABASE
        ? putDatabaseProfileConfig
        : putDatabaseSchemaProfileConfig;

    try {
      setIsUpdating(true);
      const newConfig = await api(entityId, e.formData);

      setProfilerConfig(newConfig);

      showSuccessToast(
        t('server.update-entity-success', {
          entity: t('label.profiler-setting-plural'),
        })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsUpdating(false);
      onVisibilityChange(false);
    }
  };

  const handleOnChange = (e: IChangeEvent<ProfilerConfig>) => {
    if (e.formData) {
      setProfilerConfig(e.formData);
    }
  };

  const uiSchema = useMemo(
    () => ({
      'ui:order': ['profileSampleType', '*'],
      profileSample: {
        'ui:widget':
          profilerConfig?.profileSampleType === ProfileSampleType.Percentage
            ? 'range'
            : 'updown',
      },
    }),
    [profilerConfig]
  );

  useEffect(() => {
    fetchProfilerConfig();
  }, [entityId, entityType]);

  return (
    <Modal
      centered
      destroyOnClose
      bodyStyle={{
        maxHeight: 600,
        overflowY: 'scroll',
      }}
      cancelButtonProps={{
        type: 'link',
      }}
      closable={false}
      confirmLoading={isUpdating}
      data-testid="profiler-settings-modal"
      maskClosable={false}
      okButtonProps={{
        form: 'profiler-setting-form',
        htmlType: 'submit',
      }}
      okText={t('label.save')}
      open={visible}
      title={t('label.profiler-setting-plural')}
      width={630}
      onCancel={() => onVisibilityChange(false)}>
      {isLoading ? (
        <Loader />
      ) : (
        <Form<ProfilerConfig>
          focusOnFirstError
          noHtml5Validate
          className={classNames('rjsf no-header profiler-settings-form')}
          fields={{
            BooleanField: BooleanFieldTemplate,
          }}
          formData={profilerConfig ?? {}}
          id="profiler-setting-form"
          idSeparator="/"
          schema={profilerSettingsSchema as FormProps['schema']}
          showErrorList={false}
          templates={{
            DescriptionFieldTemplate: DescriptionFieldTemplate,
            FieldErrorTemplate: FieldErrorTemplate,
            ObjectFieldTemplate: ProfilerObjectFieldTemplate,
          }}
          transformErrors={transformErrors}
          uiSchema={uiSchema}
          validator={validator as ValidatorType<ProfilerConfig>}
          widgets={{ RangeWidget: CustomRangeWidget }}
          onChange={handleOnChange}
          onSubmit={handleUpdate}
        />
      )}
    </Modal>
  );
};

export default ProfilerSettings;
