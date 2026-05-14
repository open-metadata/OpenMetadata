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
  Button,
  Checkbox,
  Input,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import { InfoCircle } from '@untitledui/icons';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Node } from 'reactflow';
import { useWorkflowModeContext } from '../../../../contexts/WorkflowModeContext';
import { EntityReference } from '../../../../generated/entity/teams/user';
import { NodeSubType } from '../../../../generated/governance/workflows/elements/nodeSubType';
import { NodeType } from '../../../../generated/governance/workflows/elements/nodeType';
import { AssigneeCandidate } from '../../../../interface/WorkflowTypes.interface';
import {
  createNodeConfig,
  isValidString,
} from '../../../../utils/WorkflowBuilderUtils';
import { UserTeamSelectableList } from '../../../common/UserTeamSelectableList/UserTeamSelectableList.component';
import { FormField } from '../common/FormField';
import { ModeAwareFormField } from '../ModeAwareFormField';
import { FormActionButtons, MetadataFormSection } from './';

interface UserApprovalFormProps {
  node: Node;
  onSave: (nodeId: string, config: Record<string, unknown>) => void;
  onClose: () => void;
  onDelete?: (nodeId: string) => void;
}

export const UserApprovalForm: React.FC<UserApprovalFormProps> = ({
  node,
  onSave,
  onClose,
  onDelete,
}) => {
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [approvalThreshold, setApprovalThreshold] = useState(1);
  const [rejectionThreshold, setRejectionThreshold] = useState(1);
  const [addReviewers, setAddReviewers] = useState(true);
  const [addOwners, setAddOwners] = useState(false);
  const [candidates, setCandidates] = useState<EntityReference[]>([]);
  const { t } = useTranslation();
  const { isFormDisabled } = useWorkflowModeContext();

  useEffect(() => {
    if (node?.data) {
      const nodeConfig = node.data.config || {};
      const assignees = (nodeConfig.assignees || {}) as {
        addReviewers?: boolean;
        addOwners?: boolean;
        candidates?: AssigneeCandidate[];
      };
      setDisplayName(node.data.displayName || node.data.label || '');
      setDescription(node.data.description || '');
      setApprovalThreshold(nodeConfig.approvalThreshold ?? 1);
      setRejectionThreshold(nodeConfig.rejectionThreshold ?? 1);
      setAddReviewers(assignees.addReviewers ?? true);
      setAddOwners(assignees.addOwners ?? false);
      setCandidates(
        Array.isArray(assignees.candidates) ? assignees.candidates : []
      );
    }
  }, [node]);

  const handleSave = () => {
    const candidatesPayload: AssigneeCandidate[] = candidates.map((c) => ({
      id: c.id,
      type: c.type ?? 'user',
      fullyQualifiedName: c.fullyQualifiedName,
      name: c.name,
    }));
    const config = createNodeConfig({
      displayName,
      description,
      type: NodeType.UserTask,
      subType: NodeSubType.UserApprovalTask,
      config: {
        approvalThreshold,
        rejectionThreshold,
        assignees: {
          addReviewers,
          addOwners,
          candidates: candidatesPayload,
        },
      },
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

  const getApproversButtonLabel = (
    list: EntityReference[],
    translate: (key: string, opts?: { count?: number }) => string
  ): string => {
    if (list.length === 0) {
      return '';
    }
    const names = list.map((c) => c.displayName || c.name || c.id);
    if (list.length <= 2) {
      return names.join(', ');
    }
    const firstTwo = names.slice(0, 2).join(', ');

    return `${firstTwo} ${translate('label.plus-count-more', {
      count: list.length - 2,
    })}`;
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

        <div className="tw:mb-6">
          <Input
            data-testid="user-approval-approval-threshold-label"
            hint={t('message.number-of-approvals-required-to-approve')}
            isDisabled={isFormDisabled}
            label={t('label.approval-threshold')}
            type="number"
            value={approvalThreshold === 0 ? '' : String(approvalThreshold)}
            onChange={(value) => {
              if (value === '') {
                setApprovalThreshold(0);
              } else {
                const numValue = parseInt(value);
                setApprovalThreshold(isNaN(numValue) ? 0 : numValue);
              }
            }}
          />
        </div>

        <div className="tw:mb-6">
          <Input
            data-testid="user-approval-rejection-threshold-label"
            hint={t('message.number-of-rejections-required-to-reject')}
            isDisabled={isFormDisabled}
            label={t('label.rejection-threshold')}
            type="number"
            value={rejectionThreshold === 0 ? '' : String(rejectionThreshold)}
            onChange={(value) => {
              if (value === '') {
                setRejectionThreshold(0);
              } else {
                const numValue = parseInt(value);
                setRejectionThreshold(isNaN(numValue) ? 0 : numValue);
              }
            }}
          />
        </div>

        <div className="tw:mb-6">
          <div className="tw:flex tw:flex-col tw:gap-4">
            <div className="tw:flex tw:items-center tw:gap-2">
              <Typography
                as="span"
                className="tw:text-sm tw:font-medium tw:text-secondary"
                data-testid="user-approval-approver-label">
                {t('label.approver-plural')}
              </Typography>
              <Tooltip title={t('message.approver-tooltip')}>
                <TooltipTrigger>
                  <InfoCircle className="tw:w-4 tw:h-4 tw:shrink-0" />
                </TooltipTrigger>
              </Tooltip>
            </div>
            <div className="tw:flex tw:items-center tw:gap-4">
              <Checkbox
                data-testid="user-approval-add-reviewers-checkbox"
                isDisabled={isFormDisabled}
                isSelected={addReviewers}
                label={t('label.reviewers')}
                onChange={setAddReviewers}
              />
              <Checkbox
                data-testid="user-approval-add-owners-checkbox"
                isDisabled={isFormDisabled}
                isSelected={addOwners}
                label={t('label.owners')}
                onChange={setAddOwners}
              />
            </div>
            <div
              className="tw:flex tw:items-center tw:gap-2 tw:text-xs tw:text-tertiary"
              data-testid="user-approval-no-reviewers-info">
              <InfoCircle className="tw:w-4 tw:h-4 tw:shrink-0" />
              <Typography as="span" className="tw:leading-snug">
                {t('message.approver-no-reviewers-info')}
              </Typography>
            </div>
            <FormField
              description={t('message.approver-users-helper')}
              label={t('label.additional-approvers')}
              showInfoIcon={false}>
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
                    data-testid="user-approval-users-select-trigger"
                    size="md">
                    <Typography
                      as="span"
                      className="tw:block tw:min-w-0 tw:overflow-hidden tw:text-ellipsis tw:whitespace-nowrap">
                      {getApproversButtonLabel(candidates, t)}
                    </Typography>
                  </Button>
                </UserTeamSelectableList>
              </ModeAwareFormField>
            </FormField>
          </div>
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
