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
import { Button, Space } from 'antd';
import classNames from 'classnames';
import DescriptionFieldTemplate from 'components/JSONSchemaTemplate/DescriptionFieldTemplate';
import { FieldErrorTemplate } from 'components/JSONSchemaTemplate/FieldErrorTemplate/FieldErrorTemplate';
import IngestionArrayFieldTemplate from 'components/JSONSchemaTemplate/IngestionArrayFieldTemplate';
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
  okText: string;
  cancelText: string;
  onCancel: () => void;
}

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
  onCancel,
  okText,
  cancelText,
}) => {
  const [internalData, setInternalData] = useState<IngestionWorkflowData>({
    name: workflowName,
  });

  const handleUpdateData = (partialData: Partial<IngestionWorkflowData>) => {
    setInternalData(partialData);
  };

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
      formContext={{ onUpdate: handleUpdateData }}
      formData={internalData}
      idSeparator="/"
      schema={schema as RJSFSchema}
      showErrorList={false}
      templates={{
        ArrayFieldTemplate: IngestionArrayFieldTemplate,
        DescriptionFieldTemplate: DescriptionFieldTemplate,
        FieldErrorTemplate: FieldErrorTemplate,
        ObjectFieldTemplate: ObjectFieldTemplate,
      }}
      uiSchema={INGESTION_WORKFLOW_UI_SCHEMA}
      validator={validator}>
      <Space className="w-full justify-end">
        <Space>
          <Button type="link" onClick={onCancel}>
            {cancelText}
          </Button>

          <Button data-testid="submit-btn" htmlType="submit" type="primary">
            {okText}
          </Button>
        </Space>
      </Space>
    </Form>
  );
};

export default IngestionWorkflowForm;
