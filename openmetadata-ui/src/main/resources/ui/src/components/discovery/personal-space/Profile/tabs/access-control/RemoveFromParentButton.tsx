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
    ButtonUtility,
    ConfirmPopover
} from '@openmetadata/ui-core-components';
import { Trash01 } from '@openmetadata/ui-core-components/icons';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';

export interface RemoveFromParentButtonProps {
  isDisabled?: boolean;
  name: string;
  parentName: string;
  /** Resolve `false` to keep the confirmation open so the user can retry. */
  onRemove: () => Promise<boolean>;
}

const RemoveFromParentButton: FC<RemoveFromParentButtonProps> = ({
  isDisabled,
  name,
  parentName,
  onRemove,
}) => {
  const { t } = useTranslation();

  return (
    <ConfirmPopover
      confirmText={t('label.remove')}
      data-testid="remove-entity-popover"
      description={t(
        'message.are-you-sure-you-want-to-remove-child-from-parent',
        { child: name, parent: parentName }
      )}
      title={t('label.remove-entity', { entity: name })}
      onConfirm={onRemove}>
      <ButtonUtility
        color="tertiary"
        data-testid={`remove-${name}`}
        icon={Trash01}
        isDisabled={isDisabled}
        size="xs"
        tooltip={t('label.remove')}
        tooltipPlacement="left"
      />
    </ConfirmPopover>
  );
};

export default RemoveFromParentButton;
