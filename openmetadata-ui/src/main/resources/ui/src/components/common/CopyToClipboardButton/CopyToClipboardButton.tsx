/*
 *  Copyright 2022 Collate.
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

import { ButtonUtility, Tooltip } from '@openmetadata/ui-core-components';
import { Copy01 } from '@untitledui/icons';
import { FunctionComponent } from 'react';
import { Placement } from 'react-aria';
import { useTranslation } from 'react-i18next';
import { useClipboard } from '../../../hooks/useClipBoard';

interface Props {
  copyText: string;
  copyTimer?: number;
  position?: Placement;
  onCopy?: () => void;
}

export const CopyToClipboardButton: FunctionComponent<Props> = ({
  copyText,
  copyTimer = 1500,
  position = 'left',
  onCopy,
}: Props) => {
  const { t } = useTranslation();
  const { hasCopied, onCopyToClipBoard } = useClipboard(
    copyText,
    copyTimer,
    onCopy
  );

  return (
    <Tooltip
      placement={position}
      title={
        hasCopied
          ? t('message.copied-to-clipboard')
          : t('message.copy-to-clipboard')
      }>
      <ButtonUtility
        color="tertiary"
        icon={Copy01}
        onClick={() => onCopyToClipBoard()}
      />
    </Tooltip>
  );
};

export default CopyToClipboardButton;
