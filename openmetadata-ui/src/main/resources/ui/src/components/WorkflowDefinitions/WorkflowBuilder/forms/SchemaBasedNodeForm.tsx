/*
 *  Copyright 2025 Collate.
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
  Input,
  TextArea,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Node } from 'reactflow';
import { NodeSubType } from '../../../../generated/governance/workflows/elements/nodeSubType';
import applyRecognizerFeedbackSchema from '../../../../jsons/governanceSchemas/automatedTask/applyRecognizerFeedbackTask.json';
import createAndRunIngestionPipelineSchema from '../../../../jsons/governanceSchemas/automatedTask/createAndRunIngestionPipelineTask.json';
import policyAgentSchema from '../../../../jsons/governanceSchemas/automatedTask/policyAgentTaskDefinition.json';
import rejectRecognizerFeedbackSchema from '../../../../jsons/governanceSchemas/automatedTask/rejectRecognizerFeedbackTask.json';
import runAppTaskSchema from '../../../../jsons/governanceSchemas/automatedTask/runAppTask.json';
import setEntityCertificationSchema from '../../../../jsons/governanceSchemas/automatedTask/setEntityCertificationTask.json';
import setGlossaryTermStatusSchema from '../../../../jsons/governanceSchemas/automatedTask/setGlossaryTermStatusTask.json';
import createRecognizerFeedbackApprovalSchema from '../../../../jsons/governanceSchemas/userTask/createRecognizerFeedbackApprovalTask.json';
import { FormActionButtons, MetadataFormSection } from './';

interface SchemaFieldDefinition {
  title?: string;
  description?: string;
  type?: string;
}

interface ConfigSchemaShape {
  properties?: Record<string, SchemaFieldDefinition>;
  $ref?: string;
}

interface NodeSchemaDefinition {
  properties?: {
    config?: ConfigSchemaShape;
  };
  definitions?: Record<string, unknown>;
}

const WORKFLOW_NODE_SCHEMAS: Partial<
  Record<NodeSubType, NodeSchemaDefinition>
> = {
  [NodeSubType.RunAppTask]: runAppTaskSchema,
  [NodeSubType.SetGlossaryTermStatusTask]: setGlossaryTermStatusSchema,
  [NodeSubType.SetEntityCertificationTask]: setEntityCertificationSchema,
  [NodeSubType.ApplyRecognizerFeedbackTask]: applyRecognizerFeedbackSchema,
  [NodeSubType.RejectRecognizerFeedbackTask]: rejectRecognizerFeedbackSchema,
  [NodeSubType.CreateAndRunIngestionPipelineTask]:
    createAndRunIngestionPipelineSchema,
  [NodeSubType.PolicyAgentTask]: policyAgentSchema,
  [NodeSubType.CreateRecognizerFeedbackApprovalTask]:
    createRecognizerFeedbackApprovalSchema,
};

const getConfigProperties = (
  schema: NodeSchemaDefinition
): Record<string, SchemaFieldDefinition> => {
  const configSchema = schema.properties?.config;
  if (!configSchema) {
    return {};
  }

  if (
    configSchema.properties &&
    Object.keys(configSchema.properties).length > 0
  ) {
    return configSchema.properties;
  }

  if (configSchema.$ref) {
    const defKey = configSchema.$ref.replace('#/definitions/', '');
    const def = schema.definitions?.[defKey] as
      | { properties?: Record<string, SchemaFieldDefinition> }
      | undefined;

    return def?.properties ?? {};
  }

  return {};
};

const renderConfigField = (
  key: string,
  fieldSchema: SchemaFieldDefinition,
  value: unknown
): React.ReactElement => {
  const label = fieldSchema.title ?? key;
  const isBoolean =
    fieldSchema.type === 'boolean' || typeof value === 'boolean';

  if (isBoolean) {
    return (
      <div className="tw:flex tw:flex-col tw:gap-2">
        <Typography
          as="p"
          className="tw:m-0 tw:text-xs tw:font-medium tw:text-secondary">
          {label}
        </Typography>
        <Toggle
          isDisabled
          isSelected={Boolean(value)}
          onChange={() => {
            return;
          }}
        />
      </div>
    );
  }

  if (typeof value === 'object' && value !== null) {
    return (
      <TextArea
        isDisabled
        label={label}
        rows={3}
        value={JSON.stringify(value, null, 2)}
        onChange={() => {
          return;
        }}
      />
    );
  }

  return (
    <Input
      isDisabled
      label={label}
      value={String(value ?? '')}
      onChange={() => {
        return;
      }}
    />
  );
};

interface SchemaBasedNodeFormProps {
  node: Node;
  onClose: () => void;
}

export const SchemaBasedNodeForm: React.FC<SchemaBasedNodeFormProps> = ({
  node,
  onClose,
}) => {
  const { t } = useTranslation();
  const subType: NodeSubType = node.data?.subType ?? node.data?.nodeSubType;
  const schema = subType ? WORKFLOW_NODE_SCHEMAS[subType] : undefined;
  const schemaProperties = schema ? getConfigProperties(schema) : {};
  const configData: Record<string, unknown> = node.data?.config ?? {};

  const configEntries = Object.keys(configData).map((key) => ({
    key,
    fieldSchema: schemaProperties[key] ?? {},
    value: configData[key],
  }));

  return (
    <>
      <div className="tw:flex-1 tw:flex tw:flex-col">
        <MetadataFormSection
          description={node.data?.description ?? ''}
          isStartNode={false}
          name={node.data?.displayName ?? node.data?.label ?? ''}
          onDescriptionChange={() => {
            return;
          }}
          onNameChange={() => {
            return;
          }}
        />
        {configEntries.map(({ key, fieldSchema, value }) => (
          <div className="tw:mb-6" key={key}>
            {renderConfigField(key, fieldSchema, value)}
          </div>
        ))}
      </div>
      <FormActionButtons
        cancelLabel={t('label.close')}
        showSave={false}
        onCancel={onClose}
        onSave={() => {
          return;
        }}
      />
    </>
  );
};
