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

import { Select, Typography } from '@openmetadata/ui-core-components';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkflowModeContext } from '../../../../contexts/WorkflowModeContext';
import { ApprovalMode } from '../../../../generated/governance/workflows/elements/triggers/eventBasedEntityTrigger';

interface ApprovalModeSectionProps {
  approvalMode?: ApprovalMode;
  lockFields?: boolean;
  onApprovalModeChange: (approvalMode: ApprovalMode) => void;
}

const MODE_DESCRIPTIONS: Record<ApprovalMode, string> = {
  [ApprovalMode.Default]: 'message.approval-mode-default-description',
  [ApprovalMode.Enforce]: 'message.approval-mode-enforce-description',
};

/** Default runs the workflow after an edit; Enforce holds the edit for its approval task. */
export const ApprovalModeSection: React.FC<ApprovalModeSectionProps> = ({
  approvalMode = ApprovalMode.Default,
  lockFields = false,
  onApprovalModeChange,
}) => {
  const { t } = useTranslation();
  const { isFormDisabled } = useWorkflowModeContext();

  return (
    <div className="tw:mt-6" data-testid="approval-mode-section">
      <Select
        data-testid="approval-mode-select"
        hint={t(MODE_DESCRIPTIONS[approvalMode])}
        isDisabled={isFormDisabled || lockFields}
        label={t('label.approval-mode')}
        value={approvalMode}
        onChange={(key) => onApprovalModeChange(key as ApprovalMode)}>
        <Select.Item
          data-testid="approval-mode-default"
          id={ApprovalMode.Default}
          label={t('label.default')}
        />
        <Select.Item
          data-testid="approval-mode-enforce"
          id={ApprovalMode.Enforce}
          label={t('label.enforce')}
        />
      </Select>
      <Typography as="p" className="tw:mt-2 tw:text-tertiary" size="text-sm">
        {t('message.approval-mode-description')}
      </Typography>
    </div>
  );
};
