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

import { AlertTriangle, Lightbulb01 } from '@untitledui/icons';
import classNames from 'classnames';
import React, { FC, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Kinds where the answer addressed a different question than the one asked. A reader who skips
 * one believes a number that answers something else, so these carry the warning icon.
 */
const DIVERGENCE_TYPES = new Set([
  'substitution',
  'proxyMetric',
  'scopeMismatch',
  'assumption',
]);

export interface MarkdownCaveatProps {
  /** Caveat kind, from the `:::caveat[type]` marker. */
  caveatType: string;
  /** Rendered message body. */
  children: ReactNode;
}

/**
 * Flags something about an answer that the surrounding prose would not make obvious: either that
 * it addressed a different question than the one asked (warning), or that a platform limitation
 * shaped it and there is something the reader can do about it (lightbulb).
 *
 * Deliberately quiet: a surface a step off the page and one warning-coloured icon, with the
 * message on the icon's own line. The icon carries the signal, so there is no heading to read
 * past, and findings about the data stay in the prose where they belong. A caveat only appears
 * when the answer diverged, which is rare, and it has to still read as rare when it does.
 *
 * The label is present for assistive technology only: without it the icon is the sole cue that
 * this block differs from the surrounding text, and that cue is purely visual.
 */
const MarkdownCaveat: FC<MarkdownCaveatProps> = ({ caveatType, children }) => {
  const { t } = useTranslation();
  const isDivergence = DIVERGENCE_TYPES.has(caveatType);
  const Icon = isDivergence ? AlertTriangle : Lightbulb01;

  return (
    <div
      className={classNames(
        'tw:flex tw:items-start tw:gap-2 tw:my-3 tw:px-3 tw:py-2',
        'tw:rounded-lg tw:bg-secondary tw:border tw:border-secondary',
        'tw:text-sm tw:text-secondary',
        'tw:[&_p]:m-0 tw:[&_p:not(:last-child)]:mb-2'
      )}
      data-testid={`markdown-caveat-${caveatType}`}
      role="note">
      <Icon
        aria-hidden
        className={classNames(
          'tw:size-4 tw:shrink-0 tw:mt-0.5',
          isDivergence ? 'tw:text-warning-primary' : 'tw:text-tertiary'
        )}
      />
      <span className="tw:sr-only">
        {isDivergence ? t('label.warning') : t('label.note')}
      </span>
      <div className="tw:min-w-0">{children}</div>
    </div>
  );
};

export default MarkdownCaveat;
