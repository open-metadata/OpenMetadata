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
  Tooltip,
  TooltipTrigger,
} from '@openmetadata/ui-core-components';
import { Check } from '@untitledui/icons';
import { FC, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useClipboard } from '../../hooks/useClipBoard';

interface CopyLinkButtonProps {
  children: ReactNode;
  url: string;
  tooltip?: string;
}

const CopyLinkButton: FC<CopyLinkButtonProps> = ({
  children,
  url,
  tooltip,
}) => {
  const { t } = useTranslation();
  const { onCopyToClipBoard, hasCopied } = useClipboard(url, 1200);
  const resolvedTooltip =
    tooltip ?? t('label.copy-item', { item: t('label.link') });

  return (
    <Tooltip isDisabled={hasCopied} title={resolvedTooltip}>
      <TooltipTrigger>
        <ButtonUtility
          className={
            hasCopied
              ? 'tw:rounded-full tw:bg-success-600 tw:text-white tw:hover:bg-success-600 tw:hover:text-white'
              : 'tw:rounded-full'
          }
          color="tertiary"
          data-testid="copy-link-btn"
          icon={
            hasCopied ? (
              <>
                <span
                  aria-hidden="true"
                  className="copy-link-ring-pulse tw:absolute tw:-inset-0.5 tw:rounded-full tw:border-2 tw:border-success-500 tw:pointer-events-none"
                />
                <Check
                  aria-hidden="true"
                  className="tw:size-3"
                  strokeWidth={2.6}
                />
              </>
            ) : (
              children
            )
          }
          size="sm"
          onClick={() => onCopyToClipBoard()}
        />
      </TooltipTrigger>
    </Tooltip>
  );
};

export default CopyLinkButton;
