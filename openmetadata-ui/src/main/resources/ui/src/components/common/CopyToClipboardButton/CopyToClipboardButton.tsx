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

import { Button, PopoverProps, Tooltip } from 'antd';
import React, { FunctionComponent } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CopyIcon } from '../../../assets/svg/icon-copy.svg';
import { useClipboard } from '../../../hooks/useClipBoard';

interface Props {
  copyText: string;
  copyTimer?: number;
  position?: PopoverProps['placement'];
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
      destroyTooltipOnHide
      placement={position}
      title={
        hasCopied ? (
          <span className="text-xs font-medium" data-testid="copy-success">
            {t('message.copied-to-clipboard')}
          </span>
        ) : (
          <span className="text-xs font-medium" data-testid="copy-tooltip">
            {t('message.copy-to-clipboard')}
          </span>
        )
      }>
      <Button
        className="h-8 m-l-md relative"
        data-testid="copy-secret"
        icon={<CopyIcon data-testid="copy-icon" width="16" />}
        type="text"
        onClick={onCopyToClipBoard}
      />
    </Tooltip>
  );
};

export default CopyToClipboardButton;
