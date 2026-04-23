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

import { Typography } from '@openmetadata/ui-core-components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Node } from 'reactflow';
import {
  createNodeConfig,
  isValidString,
} from '../../../../utils/WorkflowBuilderUtils';
import { FormActionButtons, MetadataFormSection } from './';

interface RevertBackFormProps {
  node: Node;
  onClose: () => void;
  onDelete?: (nodeId: string) => void;
  onSave: (nodeId: string, config: Record<string, unknown>) => void;
}

export const RevertBackForm: React.FC<RevertBackFormProps> = ({
  node,
  onClose,
  onDelete,
  onSave,
}) => {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (node?.data) {
      setDisplayName(node.data.displayName || node.data.label || '');
      setDescription(node.data.description || '');
    }
  }, [node]);

  const handleSave = () => {
    const config = createNodeConfig({
      description,
      displayName,
      subType: 'rollbackEntityTask',
      type: 'automatedTask',
    });

    onSave(node.id, config);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const handleDeleteNode = () => {
    if (onDelete) {
      onDelete(node.id);
    }
    onClose();
  };

  return (
    <>
      <div className="tw:flex-1 tw:flex tw:flex-col">
        <MetadataFormSection
          description={description}
          isStartNode={false}
          name={displayName}
          onDescriptionChange={setDescription}
          onNameChange={setDisplayName}
        />

        <div className="tw:bg-brand-50 tw:rounded-md tw:p-1.5">
          <Typography
            as="p"
            className="tw:m-0 tw:mb-1.5 tw:px-3 tw:py-2.5 tw:text-brand-700 tw:bg-brand-100 tw:rounded"
            size="text-xs"
            weight="semibold">
            {t('label.revert-changes')}
          </Typography>
          <Typography
            as="p"
            className="tw:m-0 tw:px-3 tw:pt-1.5 tw:pb-3 tw:text-primary"
            size="text-xs"
            weight="regular">
            {t(
              'message.this-node-will-restore-the-entity-back-to-its-last-approved-version'
            )}
          </Typography>
        </div>
      </div>

      <FormActionButtons
        showDelete
        isDisabled={!isValidString(displayName)}
        onCancel={handleCancel}
        onDelete={handleDeleteNode}
        onSave={handleSave}
      />
    </>
  );
};
