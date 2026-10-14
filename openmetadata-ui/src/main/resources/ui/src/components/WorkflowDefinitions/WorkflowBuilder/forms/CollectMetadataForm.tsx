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

import {
  Badge,
  Button,
  RadioButton,
  RadioGroup,
  Typography,
} from '@openmetadata/ui-core-components';
import { ArrowRight } from '@openmetadata/ui-core-components/icons';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Node } from 'reactflow';
import { useWorkflowModeContext } from '../../../../contexts/WorkflowModeContext';
import { EntityType } from '../../../../enums/entity.enum';
import { EntityReference } from '../../../../generated/entity/teams/user';
import {
  MetadataCollectionConfiguration,
  TaskAssignees,
} from '../../../../generated/governance/workflows/elements/nodes/automatedTask/collectMetadataTask';
import { NodeSubType } from '../../../../generated/governance/workflows/elements/nodeSubType';
import { NodeType } from '../../../../generated/governance/workflows/elements/nodeType';
import {
  createNodeConfig,
  isValidString,
} from '../../../../utils/WorkflowBuilderUtils';
import { UserTeamSelectableList } from '../../../common/UserTeamSelectableList/UserTeamSelectableList.component';
import { getRequiredFieldLabel } from '../../../Entity/Task/MetadataCompletionTask/MetadataCompletionTask.utils';
import { FormField } from '../common/FormField';
import { ModeAwareFormField } from '../ModeAwareFormField';
import { FormActionButtons } from './FormActionButtons';
import { MetadataFormSection } from './MetadataFormSection';

interface CollectMetadataFormProps {
  node: Node;
  entityTypes?: string[];
  onSave: (nodeId: string, config: Record<string, unknown>) => void;
  onClose: () => void;
  onDelete?: (nodeId: string) => void;
}

const ASSIGNEE_ORDER = [
  TaskAssignees.Owners,
  TaskAssignees.Reviewers,
  TaskAssignees.Candidates,
];

const ASSIGNEE_LABEL_KEYS: Record<TaskAssignees, string> = {
  [TaskAssignees.Owners]: 'label.owner-plural',
  [TaskAssignees.Reviewers]: 'label.reviewer-plural',
  [TaskAssignees.Candidates]: 'label.specific-users-and-teams',
};

/**
 * The stage and its required fields belong to the lifecycle that compiled this node, so they
 * are shown read-only; who is asked to fill the fields in can change here.
 */
export const CollectMetadataForm: React.FC<CollectMetadataFormProps> = ({
  node,
  entityTypes,
  onSave,
  onClose,
  onDelete,
}) => {
  const { t } = useTranslation();
  const { isFormDisabled } = useWorkflowModeContext();
  const config = (node.data?.config ?? {}) as MetadataCollectionConfiguration;
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [taskAssignees, setTaskAssignees] = useState(TaskAssignees.Owners);
  const [candidates, setCandidates] = useState<EntityReference[]>([]);

  useEffect(() => {
    const nodeConfig = (node.data?.config ??
      {}) as MetadataCollectionConfiguration;
    setDisplayName(node.data?.displayName ?? node.data?.label ?? '');
    setDescription(node.data?.description ?? '');
    setTaskAssignees(nodeConfig.taskAssignees ?? TaskAssignees.Owners);
    setCandidates((nodeConfig.candidates ?? []) as EntityReference[]);
  }, [node]);

  const handleSave = () => {
    onSave(
      node.id,
      createNodeConfig({
        displayName,
        description,
        type: NodeType.AutomatedTask,
        subType: NodeSubType.CollectMetadataTask,
        config: {
          ...config,
          taskAssignees,
          candidates:
            taskAssignees === TaskAssignees.Candidates ? candidates : [],
        },
      })
    );
    onClose();
  };

  const handleDelete = () => {
    onDelete?.(node.id);
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

        <FormField label={t('label.stage')}>
          <div
            className="tw:flex tw:items-center tw:gap-2"
            data-testid="collect-metadata-stage">
            <Badge color="gray" size="md" type="color">
              {config.stage}
            </Badge>
            {config.targetStage && (
              <>
                <ArrowRight
                  aria-hidden
                  className="tw:size-4 tw:text-fg-quaternary"
                />
                <Badge color="brand" size="md" type="color">
                  {config.targetStage}
                </Badge>
              </>
            )}
          </div>
        </FormField>

        <FormField
          description={t('message.collect-metadata-fields-hint')}
          label={t('label.required-field-plural')}>
          <ul
            className="tw:flex tw:flex-wrap tw:gap-2"
            data-testid="collect-metadata-fields">
            {(config.fields ?? []).map(({ field }) => (
              <li key={field}>
                <Badge color="brand" size="md" type="color">
                  {getRequiredFieldLabel(field, t)}
                </Badge>
              </li>
            ))}
          </ul>
        </FormField>

        <FormField
          description={t('message.collect-metadata-assignees-hint')}
          label={t('label.assign-to')}>
          <RadioGroup
            aria-label={t('label.assign-to')}
            data-testid="collect-metadata-assignees"
            isDisabled={isFormDisabled}
            value={taskAssignees}
            onChange={(value) => setTaskAssignees(value as TaskAssignees)}>
            {ASSIGNEE_ORDER.filter(
              (assignees) =>
                assignees !== TaskAssignees.Reviewers ||
                !entityTypes?.includes(EntityType.DOMAIN)
            ).map((assignees) => (
              <RadioButton
                key={assignees}
                label={t(ASSIGNEE_LABEL_KEYS[assignees])}
                value={assignees}
              />
            ))}
          </RadioGroup>
        </FormField>

        {taskAssignees === TaskAssignees.Candidates && (
          <FormField label={t('label.specific-users-and-teams')}>
            <ModeAwareFormField>
              <UserTeamSelectableList
                hasPermission
                listHeight={200}
                multiple={{ user: true, team: true }}
                owner={candidates}
                popoverProps={{
                  placement: 'bottomLeft',
                  overlayStyle: { zIndex: 10000 },
                }}
                onUpdate={(updated) => setCandidates(updated ?? [])}>
                <Button
                  className="tw:h-10 tw:w-full tw:min-w-0 tw:justify-start tw:overflow-hidden"
                  color="secondary"
                  data-testid="collect-metadata-candidates-trigger"
                  size="md">
                  <Typography
                    as="span"
                    className="tw:block tw:min-w-0 tw:overflow-hidden tw:text-ellipsis tw:whitespace-nowrap">
                    {candidates
                      .map(
                        (candidate) =>
                          candidate.displayName ||
                          candidate.name ||
                          candidate.id
                      )
                      .join(', ')}
                  </Typography>
                </Button>
              </UserTeamSelectableList>
            </ModeAwareFormField>
          </FormField>
        )}
      </div>

      <FormActionButtons
        showDelete
        isDisabled={
          !isValidString(displayName) ||
          (taskAssignees === TaskAssignees.Candidates &&
            candidates.length === 0)
        }
        onCancel={onClose}
        onDelete={handleDelete}
        onSave={handleSave}
      />
    </>
  );
};
