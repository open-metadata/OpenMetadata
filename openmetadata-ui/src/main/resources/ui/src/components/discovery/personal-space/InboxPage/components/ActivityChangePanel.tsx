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

import { Badge, Box, Typography } from '@openmetadata/ui-core-components';
import { ArrowRight } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import RichTextEditorPreviewerV1 from '../../../../../components/common/RichTextEditor/RichTextEditorPreviewerV1';
import { ActivityChange } from '../inbox.utils';

type ChangeTone = 'error' | 'success';

const CHANGE_SIGN: Record<ChangeTone, string> = { error: '−', success: '+' };

interface ChangeColumnProps {
  title: string;
  values: string[];
  tone: ChangeTone;
  isText: boolean;
}

// What was there reads recessed on a subtle surface; what replaced it sits on
// the panel's own surface, its label a step darker. The padding leaves room
// for the arrow on the rule between them.
const COLUMN_TONE_CLASS: Record<ChangeTone, { column: string; title: string }> =
  {
    error: {
      column: 'tw:bg-secondary_subtle tw:pt-3 tw:pr-4.5 tw:pb-3.5 tw:pl-3.5',
      title: 'tw:text-quaternary',
    },
    success: {
      column: 'tw:pt-3 tw:pr-3.5 tw:pb-3.5 tw:pl-5.5',
      title: 'tw:text-secondary',
    },
  };

// Two values can read the same (two owners sharing a display name), so each
// key carries how many times its value came before it.
const keyValues = (values: string[]) => {
  const seen = new Map<string, number>();

  return values.map((value) => {
    const occurrence = seen.get(value) ?? 0;
    seen.set(value, occurrence + 1);

    return { value, key: `${value}-${occurrence}` };
  });
};

const ChangeColumn = ({ title, values, tone, isText }: ChangeColumnProps) => (
  <Box
    className={classNames(
      'tw:min-w-0 tw:flex-1',
      COLUMN_TONE_CLASS[tone].column
    )}
    data-testid={`activity-change-${tone}`}
    direction="col"
    gap={2}>
    <Typography
      className={COLUMN_TONE_CLASS[tone].title}
      size="text-xs"
      weight="medium">
      {title}
    </Typography>
    {isText ? (
      <RichTextEditorPreviewerV1
        className="tw:text-sm tw:text-secondary"
        markdown={values[0]}
      />
    ) : (
      <Box className="tw:gap-1.5" wrap="wrap">
        {keyValues(values).map(({ value, key }) => (
          <Badge color={tone} key={key} size="sm" type="color">
            {`${CHANGE_SIGN[tone]} ${value}`}
          </Badge>
        ))}
      </Box>
    )}
  </Box>
);

/**
 * The card's change panel: the field, how many values it gained or lost, and
 * what was removed beside what was added. A side shows only when it has
 * something, since an event records the change, not the full list.
 */
const ActivityChangePanel = ({ change }: { change: ActivityChange }) => {
  const { t } = useTranslation();
  const { labelKey, before, after, isText } = change;
  const hasBoth = before.length > 0 && after.length > 0;

  return (
    <Box
      className="tw:overflow-hidden tw:rounded-lg tw:border tw:border-secondary"
      data-testid="activity-change-panel"
      direction="col">
      <Box
        align="center"
        className="tw:h-9 tw:border-b tw:border-secondary tw:bg-secondary_subtle tw:px-3.5"
        gap={2}>
        <Typography
          className="tw:text-secondary"
          size="text-xs"
          weight="semibold">
          {t(labelKey)}
        </Typography>
        {!isText && after.length > 0 && (
          <Badge color="success" size="sm" type="color">
            {`+${after.length}`}
          </Badge>
        )}
        {!isText && before.length > 0 && (
          <Badge color="error" size="sm" type="color">
            {`−${before.length}`}
          </Badge>
        )}
      </Box>
      {/* Top-aligned columns split by a rule, the arrow sitting on it. */}
      <Box className="tw:relative tw:divide-x tw:divide-secondary">
        {before.length > 0 && (
          <ChangeColumn
            isText={isText}
            title={t('label.before')}
            tone="error"
            values={before}
          />
        )}
        {hasBoth && (
          <span
            aria-hidden
            className={classNames(
              'tw:absolute tw:top-1/2 tw:left-1/2 tw:flex tw:size-6 tw:-translate-1/2 tw:items-center tw:justify-center',
              'tw:rounded-full tw:border tw:border-secondary tw:bg-primary tw:shadow-xs'
            )}>
            <ArrowRight className="tw:size-3.5 tw:text-fg-quaternary" />
          </span>
        )}
        {after.length > 0 && (
          <ChangeColumn
            isText={isText}
            title={t('label.after')}
            tone="success"
            values={after}
          />
        )}
      </Box>
    </Box>
  );
};

export default ActivityChangePanel;
