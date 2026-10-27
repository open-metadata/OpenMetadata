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
import { useTranslation } from 'react-i18next';

interface RemoveFromTeamButtonProps {
  childName: string;
  parentName: string;
  isDisabled?: boolean;
  'data-testid': string;
  // Resolving false keeps the confirmation open so the user can retry.
  onConfirm: () => Promise<boolean>;
}

const RemoveFromTeamButton = ({
  childName,
  parentName,
  isDisabled,
  'data-testid': dataTestId,
  onConfirm,
}: RemoveFromTeamButtonProps) => {
  const { t } = useTranslation();

  return (
    <ConfirmPopover
      confirmText={t('label.remove')}
      data-testid="remove-from-team-popover"
      description={t(
        'message.are-you-sure-you-want-to-remove-child-from-parent',
        {
          child: childName,
          parent: parentName,
        }
      )}
      title={t('label.remove-entity', { entity: childName })}
      onConfirm={onConfirm}>
      <ButtonUtility
        color="tertiary"
        data-testid={dataTestId}
        icon={Trash01}
        isDisabled={isDisabled}
        size="xs"
        tooltip={t('label.remove')}
        tooltipPlacement="left"
      />
    </ConfirmPopover>
  );
};

export default RemoveFromTeamButton;
