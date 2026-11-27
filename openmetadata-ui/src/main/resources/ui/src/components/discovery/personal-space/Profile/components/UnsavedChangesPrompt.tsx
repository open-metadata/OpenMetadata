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
import { ConfirmPopover } from '@openmetadata/ui-core-components';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';

interface UnsavedChangesPromptProps {
  isOpen: boolean;
  triggerRef: RefObject<Element | null>;
  onDiscard: () => void;
  onCancel: () => void;
  /** Offers "Save & go" when the editor can tell a save succeeded. */
  onSave?: () => Promise<void> | void;
}

const UnsavedChangesPrompt = ({
  isOpen,
  triggerRef,
  onDiscard,
  onCancel,
  onSave,
}: UnsavedChangesPromptProps) => {
  const { t } = useTranslation();

  return onSave ? (
    <ConfirmPopover
      actions={[
        {
          key: 'discard',
          label: t('label.discard-and-go'),
          'data-testid': 'unsaved-changes-popover-discard',
          onPress: onDiscard,
        },
      ]}
      confirmText={t('label.save-and-go')}
      data-testid="unsaved-changes-popover"
      isOpen={isOpen}
      showCancel={false}
      title={t('message.save-changes-first')}
      triggerRef={triggerRef}
      variant="primary"
      onConfirm={onSave}
      onOpenChange={(open) => !open && onCancel()}
    />
  ) : (
    <ConfirmPopover
      cancelText={t('label.continue-editing')}
      confirmText={t('label.discard-and-go')}
      data-testid="unsaved-changes-popover"
      description={t('message.unsaved-changes-warning')}
      isOpen={isOpen}
      title={t('label.unsaved-changes')}
      triggerRef={triggerRef}
      variant="destructive"
      onCancel={onCancel}
      onConfirm={onDiscard}
      onOpenChange={(open) => !open && onCancel()}
    />
  );
};

export default UnsavedChangesPrompt;
