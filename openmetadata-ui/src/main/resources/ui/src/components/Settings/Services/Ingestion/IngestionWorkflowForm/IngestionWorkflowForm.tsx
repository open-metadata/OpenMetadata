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
import Form, { IChangeEvent } from '@rjsf/core';
import { RegistryFieldsType } from '@rjsf/utils';
import { customizeValidator } from '@rjsf/validator-ajv8';
import { Button, Space } from 'antd';
import classNames from 'classnames';
import { isUndefined, omit, omitBy } from 'lodash';
import React, { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  INGESTION_ELASTIC_SEARCH_WORKFLOW_UI_SCHEMA,
  INGESTION_WORKFLOW_NAME_UI_SCHEMA,
  INGESTION_WORKFLOW_UI_SCHEMA,
} from '../../../../../constants/Services.constant';
import { FormSubmitType } from '../../../../../enums/form.enum';
import {
  DbtConfigType,
  PipelineType,
} from '../../../../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import {
  IngestionWorkflowData,
  IngestionWorkflowFormProps,
} from '../../../../../interface/service.interface';
import { transformErrors } from '../../../../../utils/formUtils';
import { getSchemaByWorkflowType } from '../../../../../utils/IngestionWorkflowUtils';
import BooleanFieldTemplate from '../../../../common/Form/JSONSchema/JSONSchemaTemplate/BooleanFieldTemplate';
import DescriptionFieldTemplate from '../../../../common/Form/JSONSchema/JSONSchemaTemplate/DescriptionFieldTemplate';
import { FieldErrorTemplate } from '../../../../common/Form/JSONSchema/JSONSchemaTemplate/FieldErrorTemplate/FieldErrorTemplate';
import { ObjectFieldTemplate } from '../../../../common/Form/JSONSchema/JSONSchemaTemplate/ObjectFieldTemplate';
import WorkflowArrayFieldTemplate from '../../../../common/Form/JSONSchema/JSONSchemaTemplate/WorkflowArrayFieldTemplate';

const IngestionWorkflowForm: FC<IngestionWorkflowFormProps> = ({
  pipeLineType,
  className,
  okText,
  cancelText,
  serviceCategory,
  workflowData,
  operationType,
  onCancel,
  onFocus,
  onSubmit,
  onChange,
}) => {
  const [internalData, setInternalData] =
    useState<IngestionWorkflowData>(workflowData);
  const { t } = useTranslation();

  const schema = useMemo(
    () => getSchemaByWorkflowType(pipeLineType, serviceCategory),

    [pipeLineType, serviceCategory]
  );

  const validator = useMemo(
    () => customizeValidator<IngestionWorkflowData>(),
    []
  );

  const isElasticSearchPipeline =
    pipeLineType === PipelineType.ElasticSearchReindex;

  const isDbtPipeline = pipeLineType === PipelineType.Dbt;

  const uiSchema = useMemo(() => {
    let commonSchema = { ...INGESTION_WORKFLOW_UI_SCHEMA };
    if (isElasticSearchPipeline) {
      commonSchema = {
        ...commonSchema,
        ...INGESTION_ELASTIC_SEARCH_WORKFLOW_UI_SCHEMA,
      };
    }

    if (operationType === FormSubmitType.EDIT) {
      commonSchema = { ...commonSchema, ...INGESTION_WORKFLOW_NAME_UI_SCHEMA };
    }

    return commonSchema;
  }, [pipeLineType, operationType]);

  const handleOnChange = (e: IChangeEvent<IngestionWorkflowData>) => {
    if (e.formData) {
      setInternalData(e.formData);

      let formData = { ...e.formData };
      if (isElasticSearchPipeline) {
        formData = {
          ...omit(formData, [
            'useSSL',
            'verifyCerts',
            'timeout',
            'caCerts',
            'useAwsCredentials',
            'regionName',
          ]),
        };
      }
      if (isDbtPipeline) {
        formData = {
          ...formData,
          dbtConfigSource: {
            ...omitBy(formData.dbtConfigSource ?? {}, isUndefined),
            dbtConfigType: formData.dbtConfigSource
              ?.dbtConfigType as DbtConfigType,
          },
        };
      }
      onChange?.(formData);
    }
  };

  const customFields: RegistryFieldsType = {
    BooleanField: BooleanFieldTemplate,
    ArrayField: WorkflowArrayFieldTemplate,
  };

  const handleSubmit = (e: IChangeEvent<IngestionWorkflowData>) => {
    if (e.formData) {
      let formData = { ...e.formData };
      if (isElasticSearchPipeline) {
        formData = {
          ...omit(formData, [
            'useSSL',
            'verifyCerts',
            'timeout',
            'caCerts',
            'useAwsCredentials',
            'regionName',
          ]),
        };
      }
      if (isDbtPipeline) {
        formData = {
          ...formData,
          dbtConfigSource: {
            ...omitBy(formData.dbtConfigSource ?? {}, isUndefined),
            dbtConfigType: formData.dbtConfigSource
              ?.dbtConfigType as DbtConfigType,
          },
        };
      }

      onSubmit(formData);
    }
  };

  return (
    <Form
      focusOnFirstError
      noHtml5Validate
      className={classNames('rjsf no-header', className)}
      fields={customFields}
      formContext={{ handleFocus: onFocus }}
      formData={internalData}
      idSeparator="/"
      schema={schema}
      showErrorList={false}
      templates={{
        DescriptionFieldTemplate: DescriptionFieldTemplate,
        FieldErrorTemplate: FieldErrorTemplate,
        ObjectFieldTemplate: ObjectFieldTemplate,
      }}
      transformErrors={transformErrors}
      uiSchema={uiSchema}
      validator={validator}
      onChange={handleOnChange}
      onFocus={onFocus}
      onSubmit={handleSubmit}>
      <div className="d-flex w-full justify-end">
        <Space>
          <Button type="link" onClick={onCancel}>
            {cancelText ?? t('label.cancel')}
          </Button>

          <Button data-testid="submit-btn" htmlType="submit" type="primary">
            {okText ?? t('label.submit')}
          </Button>
        </Space>
      </div>
    </Form>
  );
};

export default IngestionWorkflowForm;
