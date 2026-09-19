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
  Dialog,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import { OnboardingPlaybook } from '../../../generated/entity/governance/onboardingPlaybook';
import { CustomProperty } from '../../../generated/entity/type';
import { WorkflowDefinition } from '../../../generated/governance/workflows/workflowDefinition';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { OnboardingPreview } from '../onboarding/OnboardingPreview';

interface PlaybookPreviewModalProps {
  playbook: OnboardingPlaybook;
  stage: string;
  /** Without them an `extension.*` check has no editor and the preview is a blank row. */
  properties: CustomProperty[];
  workflows: WorkflowDefinition[];
  onStageChange: (stage: string) => void;
  onClose: () => void;
}

/**
 * The playbook as the person creating the asset will meet it. Previewing as the signed-in user is
 * what makes the assignee resolution real rather than illustrative.
 */
export const PlaybookPreviewModal = ({
  playbook,
  stage,
  properties,
  workflows,
  onStageChange,
  onClose,
}: PlaybookPreviewModalProps) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();

  if (!currentUser) {
    return null;
  }

  return (
    <ModalOverlay isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal>
        <Dialog
          showCloseButton
          aria-label={t('label.preview-as-producer')}
          width={960}
          onClose={onClose}>
          <Dialog.Header>
            <Typography className="tw:text-md tw:font-semibold tw:text-primary">
              {t('label.preview-as-producer')}
            </Typography>
          </Dialog.Header>
          <div className="tw:p-4">
            <OnboardingPreview
              creator={{
                id: currentUser.id,
                type: EntityType.USER,
                name: currentUser.name,
                displayName: currentUser.displayName,
              }}
              form={playbook}
              properties={properties}
              stage={stage}
              workflows={workflows}
              onStageChange={onStageChange}
            />
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
