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
  ButtonProps,
  ButtonUtility,
  ButtonUtilityProps,
} from '@openmetadata/ui-core-components';
import { Check, Copy01 } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { FC, MouseEvent } from 'react';
import type { Placement } from 'react-aria';
import { useTranslation } from 'react-i18next';
import { useClipboard } from '../../../hooks/useClipBoard';

const COPIED_RESET_MS = 1200;

const SUCCESS_CLASSES = [
  'tw:bg-success-solid',
  'tw:text-fg-white',
  'tw:after:outline-0',
  'tw:shadow-none',
  'tw:hover:bg-success-solid',
  'tw:dark:hover:bg-success-solid',
  'tw:hover:text-fg-white',
  'tw:*:data-icon:text-fg-white',
  'tw:hover:*:data-icon:text-fg-white',
].join(' ');

interface CopyButtonProps {
  value: string;
  // Renders a text button instead of the icon-only one; the text flips to "Copied" on success.
  label?: string;
  tooltip?: string;
  tooltipPlacement?: Placement;
  className?: string;
  size?: NonNullable<ButtonUtilityProps['size']>;
  labelSize?: NonNullable<ButtonProps['size']>;
  color?: NonNullable<ButtonUtilityProps['color']>;
  labelColor?: NonNullable<ButtonProps['color']>;
  testId?: string;
  isDisabled?: boolean;
  onCopy?: () => void;
}

const RingPulse = () => (
  <span
    aria-hidden="true"
    className="copy-link-ring-pulse tw:absolute tw:-inset-0.5 tw:rounded-full tw:border-2 tw:border-utility-success-500 tw:pointer-events-none"
  />
);

const CopyButton: FC<CopyButtonProps> = ({
  value,
  label,
  tooltip,
  tooltipPlacement,
  className,
  size = 'lg',
  labelSize = 'sm',
  color,
  labelColor = 'secondary',
  testId = 'copy-link-btn',
  isDisabled,
  onCopy,
}) => {
  const { t } = useTranslation();
  const { onCopyToClipBoard, hasCopied } = useClipboard(
    value,
    COPIED_RESET_MS,
    onCopy
  );

  // Copy buttons sit inside clickable rows and cards; a copy must not also open them.
  const handleClick = (e: MouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    void onCopyToClipBoard(value);
  };

  if (label) {
    return (
      <Button
        className={classNames(
          // Labeled buttons get a smaller glyph so the icon sits at text height.
          'tw:*:data-icon:size-4',
          className,
          hasCopied && SUCCESS_CLASSES
        )}
        color={labelColor}
        data-testid={testId}
        iconLeading={
          hasCopied ? <Check data-icon aria-hidden="true" /> : Copy01
        }
        isDisabled={isDisabled}
        size={labelSize}
        onClick={handleClick}>
        {hasCopied ? t('label.copied') : label}
      </Button>
    );
  }

  const tooltipText =
    tooltip ?? t('label.copy-item', { item: t('label.link') });

  return (
    <ButtonUtility
      className={classNames(
        // Radius must animate with the colours, or the button flashes as a green square on reset.
        'tw:transition-[background-color,border-radius,color,box-shadow,opacity] tw:duration-200 tw:ease-out tw:motion-reduce:transition-none',
        hasCopied ? 'tw:rounded-full' : 'tw:rounded-md',
        // Callers may restyle the shape (e.g. flush inside an input group), but the
        // copied colours must still win over their idle hover background.
        className,
        hasCopied && SUCCESS_CLASSES
      )}
      color={color}
      data-testid={testId}
      icon={
        hasCopied ? (
          <>
            <RingPulse />
            <Check data-icon aria-hidden="true" />
          </>
        ) : (
          Copy01
        )
      }
      isDisabled={isDisabled}
      size={size}
      tooltip={hasCopied ? t('label.copied') : tooltipText}
      tooltipPlacement={tooltipPlacement}
      onClick={handleClick}
    />
  );
};

export default CopyButton;
