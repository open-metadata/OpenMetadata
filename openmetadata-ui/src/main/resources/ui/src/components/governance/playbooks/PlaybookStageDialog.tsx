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
  Button,
  Dialog,
  Input,
  Modal,
  ModalOverlay,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EntityStatus,
  OnboardingStageDefinition,
} from '../../../generated/entity/governance/onboardingPlaybook';
import { STAGE_STATUS_OPTIONS } from '../../../utils/governance/playbooks/Playbook.utils';

const NO_STATUS = 'none';

interface PlaybookStageDialogProps {
  /** The stage being renamed, or undefined when adding one. */
  stage?: OnboardingStageDefinition;
  onSave: (displayName: string, entityStatus?: EntityStatus) => void;
  onClose: () => void;
}

/**
 * Name a stage and, optionally, say which status an asset carries while it sits there.
 *
 * <p>The status is what the handoff workflow is expected to set on arrival; leaving it unset is
 * normal for stages the platform has no status for, and is never guessed on the author's behalf.
 */
export const PlaybookStageDialog = ({
  stage,
  onSave,
  onClose,
}: PlaybookStageDialogProps) => {
  const { t } = useTranslation();
  const [name, setName] = useState(stage?.displayName ?? '');
  const [status, setStatus] = useState<string>(
    stage?.entityStatus ?? NO_STATUS
  );
  const title = stage
    ? t('label.rename-entity', { entity: t('label.stage') })
    : t('label.add-stage');

  /*
   * The name is the only thing this dialog exists for, so the caret starts there rather than on the
   * dialog element react-aria focuses by default - it only claims focus when nothing inside already
   * has it, so this has to happen as the field attaches. The input is reached through the field
   * group because this app is on React 18, where a `ref` prop never reaches a function component.
   */
  const focusName = useCallback((group: HTMLDivElement | null) => {
    group?.querySelector('input')?.focus();
  }, []);

  return (
    <ModalOverlay isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal>
        <Dialog
          showCloseButton
          aria-label={title}
          width={440}
          onClose={onClose}>
          <Dialog.Header>
            <Typography className="tw:text-md tw:font-semibold tw:text-primary">
              {title}
            </Typography>
          </Dialog.Header>

          <div className="tw:flex tw:flex-col tw:gap-4 tw:p-4">
            <Input
              groupRef={focusName}
              inputDataTestId="stage-name"
              label={t('label.name')}
              value={name}
              onChange={setName}
            />
            <Select
              data-testid="stage-status"
              hint={t('message.stage-status-is-set-by-the-workflow')}
              label={t('label.status')}
              selectedKey={status}
              onSelectionChange={(key) => setStatus(String(key))}>
              <Select.Item id={NO_STATUS} label={t('label.none')}>
                {t('label.none')}
              </Select.Item>
              {STAGE_STATUS_OPTIONS.map((option) => (
                <Select.Item id={option} key={option} label={option}>
                  {option}
                </Select.Item>
              ))}
            </Select>
          </div>

          <Dialog.Footer>
            <Button color="secondary" size="md" onPress={onClose}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              data-testid="save-stage"
              isDisabled={!name.trim()}
              size="md"
              onPress={() =>
                onSave(
                  name.trim(),
                  status === NO_STATUS ? undefined : (status as EntityStatus)
                )
              }>
              {t('label.save')}
            </Button>
          </Dialog.Footer>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
