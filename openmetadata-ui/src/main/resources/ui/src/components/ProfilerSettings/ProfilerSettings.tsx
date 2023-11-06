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

import React, { FC, useEffect, useState } from 'react';

import Form, { FormProps, IChangeEvent } from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { Button } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../enums/entity.enum';
import { DatabaseProfilerConfig as ProfilerConfig } from '../../generated/entity/data/database';
import profilerSettingsSchema from '../../jsons/profilerSettings.json';
import {
  getDatabaseProfilerConfig,
  getDatabaseSchemaProfilerConfig,
  putDatabaseProfileConfig,
  putDatabaseSchemaProfileConfig,
} from '../../rest/databaseAPI';
import { transformErrors } from '../../utils/formUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import BooleanFieldTemplate from '../JSONSchemaTemplate/BooleanFieldTemplate';
import DescriptionFieldTemplate from '../JSONSchemaTemplate/DescriptionFieldTemplate';
import { FieldErrorTemplate } from '../JSONSchemaTemplate/FieldErrorTemplate/FieldErrorTemplate';
import Loader from '../Loader/Loader';
import './profiler-settings.less';
import { ProfilerObjectFieldTemplate } from './ProfilerObjectFieldTemplate';

interface ProfilerSettingsProps {
  entityId: string;
  entityType: EntityType.DATABASE | EntityType.DATABASE_SCHEMA;
}

const ProfilerSettings: FC<ProfilerSettingsProps> = ({
  entityId,
  entityType,
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
    }
  };

  const uiSchema = {
    'ui:order': ['profileSampleType', '*'],
  };

  useEffect(() => {
    fetchProfilerConfig();
  }, [entityId, entityType]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <div className="max-width-md w-9/10 profiler-settings-form-container">
      <Form
        focusOnFirstError
        noHtml5Validate
        className={classNames('rjsf no-header')}
        fields={{
          BooleanField: BooleanFieldTemplate,
        }}
        formData={profilerConfig ?? {}}
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
        validator={validator}
        onSubmit={handleUpdate}>
        <div className="d-flex w-full justify-end">
          <Button
            data-testid="submit-btn"
            htmlType="submit"
            loading={isUpdating}
            type="primary">
            {t('label.update')}
          </Button>
        </div>
      </Form>
    </div>
  );
};

export default ProfilerSettings;
