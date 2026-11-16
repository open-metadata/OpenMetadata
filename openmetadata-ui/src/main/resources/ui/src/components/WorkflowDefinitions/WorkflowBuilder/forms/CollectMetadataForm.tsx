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
  Box,
  Button,
  RadioButton,
  RadioGroup,
  Typography,
} from '@openmetadata/ui-core-components';
import { ArrowRight } from '@openmetadata/ui-core-components/icons';
import { noop } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Node } from 'reactflow';
import { useWorkflowModeContext } from '../../../../contexts/WorkflowModeContext';
import { EntityType } from '../../../../enums/entity.enum';
import { EntityReference } from '../../../../generated/entity/teams/user';
import {
  MetadataCollectionConfiguration,
  Revision,
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
import { SearchOutputType } from '../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import { FormField } from '../common/FormField';
import { ModeAwareFormField } from '../ModeAwareFormField';
import { AskedGroupWarning } from './AskedGroupWarning';
import { FormActionButtons } from './FormActionButtons';
import { MetadataFormSection } from './MetadataFormSection';
import { QueryBuilderSection } from './QueryBuilderSection';

interface CollectMetadataFormProps {
  node: Node;
  entityTypes?: EntityType[];
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

/** Whether the node asks specific users or teams; a step closing a revision request asks nobody. */
const asksCandidates = (
  config: MetadataCollectionConfiguration,
  taskAssignees: TaskAssignees
) =>
  config.revision !== Revision.Resubmit &&
  taskAssignees === TaskAssignees.Candidates;

/** What a revision step does: ask the stage's people to revise, or close that request. */
const RevisionHint = ({
  revision,
  stage,
}: Pick<MetadataCollectionConfiguration, 'revision' | 'stage'>) => {
  const { t } = useTranslation();

  return revision ? (
    <FormField label={t('label.revise-and-resubmit')}>
      <Typography
        as="p"
        color="secondary"
        data-testid="collect-metadata-revision"
        size="text-sm">
        {t(
          revision === Revision.Request
            ? 'message.collect-metadata-revision-request-hint'
            : 'message.collect-metadata-revision-resubmit-hint',
          { stage }
        )}
      </Typography>
    </FormField>
  ) : null;
};

interface AssigneeSectionProps {
  config: MetadataCollectionConfiguration;
  entityTypes?: EntityType[];
  isDisabled: boolean;
  taskAssignees: TaskAssignees;
  onChange: (assignees: TaskAssignees) => void;
}

/** Who gets the task; a step that only closes a revision request asks nobody. */
const AssigneeSection = ({
  config,
  entityTypes,
  isDisabled,
  taskAssignees,
  onChange,
}: AssigneeSectionProps) => {
  const { t } = useTranslation();

  return config.revision === Revision.Resubmit ? null : (
    <>
      <FormField
        description={t(
          config.revision === Revision.Request
            ? 'message.collect-metadata-revision-assignees-hint'
            : 'message.collect-metadata-assignees-hint'
        )}
        label={t('label.assign-to')}>
        <RadioGroup
          aria-label={t('label.assign-to')}
          data-testid="collect-metadata-assignees"
          isDisabled={isDisabled}
          value={taskAssignees}
          onChange={(value) => onChange(value as TaskAssignees)}>
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
      <AskedGroupWarning
        assignees={taskAssignees}
        fields={config.fields}
        groupLabel={t(ASSIGNEE_LABEL_KEYS[taskAssignees])}
      />
    </>
  );
};

/**
 * The stage, its required fields and its conditions belong to the lifecycle that compiled this
 * node, so they are shown read-only; who is asked to complete them can change here.
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
          candidates: asksCandidates(config, taskAssignees) ? candidates : [],
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
      <Box className="tw:flex-1" direction="col">
        <MetadataFormSection
          description={description}
          isStartNode={false}
          name={displayName}
          onDescriptionChange={setDescription}
          onNameChange={setDisplayName}
        />

        <FormField label={t('label.stage')}>
          <Box align="center" data-testid="collect-metadata-stage" gap={2}>
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
          </Box>
        </FormField>

        {Boolean(config.fields?.length) && (
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
        )}

        <RevisionHint revision={config.revision} stage={config.stage} />

        {config.conditions && (
          <div data-testid="collect-metadata-conditions">
            <QueryBuilderSection
              forceReadOnly
              entityTypes={entityTypes?.[0] ?? EntityType.ALL}
              label={t('label.condition-plural')}
              outputType={SearchOutputType.JSONLogic}
              showExploreLink={false}
              value={config.conditions}
              onChange={noop}
            />
          </div>
        )}

        <AssigneeSection
          config={config}
          entityTypes={entityTypes}
          isDisabled={isFormDisabled}
          taskAssignees={taskAssignees}
          onChange={setTaskAssignees}
        />

        {asksCandidates(config, taskAssignees) && (
          <FormField label={t('label.specific-users-and-teams')}>
            <ModeAwareFormField>
              <UserTeamSelectableList
                hasPermission
                listHeight={200}
                multiple={{ user: true, team: true }}
                owner={candidates}
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
      </Box>

      <FormActionButtons
        showDelete
        isDisabled={
          !isValidString(displayName) ||
          (asksCandidates(config, taskAssignees) && candidates.length === 0)
        }
        onCancel={onClose}
        onDelete={handleDelete}
        onSave={handleSave}
      />
    </>
  );
};
