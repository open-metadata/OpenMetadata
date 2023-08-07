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
import Form, { FormProps } from '@rjsf/core';
import { RJSFSchema } from '@rjsf/utils';
import classNames from 'classnames';
import { ArrayFieldTemplate } from 'components/JSONSchemaTemplate/ArrayFieldTemplate';
import DescriptionFieldTemplate from 'components/JSONSchemaTemplate/DescriptionFieldTemplate';
import { FieldErrorTemplate } from 'components/JSONSchemaTemplate/FieldErrorTemplate/FieldErrorTemplate';
import { ObjectFieldTemplate } from 'components/JSONSchemaTemplate/ObjectFieldTemplate';
import { INGESTION_WORKFLOW_UI_SCHEMA } from 'constants/Services.constant';
import { PipelineType } from 'generated/entity/services/ingestionPipelines/ingestionPipeline';
import { IngestionWorkflowData } from 'interface/service.interface';
import databaseMetadataPipeline from 'jsons/ingestionSchemas/databaseServiceMetadataPipeline.json';
import React, { FC, useMemo, useState } from 'react';
import { customValidate } from 'utils/formUtils';

interface IngestionWorkflowFormProps extends FormProps {
  pipeLineType: PipelineType;
  workflowName: string;
}

const INITIAL_DATA: IngestionWorkflowData = {
  schemaFilterPattern: {
    includes: [],
    excludes: [],
  },
  tableFilterPattern: {
    includes: [],
    excludes: [],
  },
  databaseFilterPattern: {
    includes: [],
    excludes: [],
  },
  name: '',
};

const CUSTOM_PROPERTY = {
  name: {
    description: 'Name of the workflow',
    type: 'string',
  },
};

const IngestionWorkflowForm: FC<IngestionWorkflowFormProps> = ({
  pipeLineType,
  validator,
  className,
  workflowName,
}) => {
  const [initialData] = useState<IngestionWorkflowData>({
    ...INITIAL_DATA,
    name: workflowName,
  });

  const schema = useMemo(() => {
    switch (pipeLineType) {
      case PipelineType.Metadata:
      default:
        return {
          ...databaseMetadataPipeline,
          properties: {
            ...databaseMetadataPipeline.properties,
            ...CUSTOM_PROPERTY,
          },
          required: [
            ...((databaseMetadataPipeline as RJSFSchema).required ?? []),
            'name',
          ],
        };
    }
  }, [pipeLineType]);

  return (
    <Form
      focusOnFirstError
      noHtml5Validate
      omitExtraData
      className={classNames('rjsf no-header', className)}
      customValidate={customValidate}
      formData={initialData}
      idSeparator="/"
      schema={schema as RJSFSchema}
      showErrorList={false}
      templates={{
        ArrayFieldTemplate: ArrayFieldTemplate,
        DescriptionFieldTemplate: DescriptionFieldTemplate,
        FieldErrorTemplate: FieldErrorTemplate,
        ObjectFieldTemplate: ObjectFieldTemplate,
      }}
      uiSchema={INGESTION_WORKFLOW_UI_SCHEMA}
      validator={validator}
    />
  );
};

export default IngestionWorkflowForm;
