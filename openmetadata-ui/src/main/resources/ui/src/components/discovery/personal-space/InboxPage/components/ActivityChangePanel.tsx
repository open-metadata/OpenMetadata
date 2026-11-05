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
import { ActivityChange, INBOX_RECESSED_SURFACE_CLASS } from '../inbox.utils';
import { ACTIVITY_CARD_PANEL_HOVER_CLASS } from './ActivityFeedItem.constants';

type ChangeTone = 'error' | 'success';

const CHANGE_SIGN: Record<ChangeTone, string> = { error: '−', success: '+' };

interface ChangeColumnProps {
  title: string;
  values: string[];
  // Shown on both sides, neutral, ahead of what changed.
  kept: string[];
  tone: ChangeTone;
  isText: boolean;
}

// What was there sits on a subtle surface; what replaced it, in light, on the
// panel's own. In dark both sides share the well: two surfaces side by side
// there read as a mismatch rather than a before and after. Both titles read
// alike. The padding leaves room for the arrow on the rule between them.
const COLUMN_TONE_CLASS: Record<ChangeTone, string> = {
  error: classNames(
    INBOX_RECESSED_SURFACE_CLASS,
    'tw:pt-3 tw:pr-4.5 tw:pb-3.5 tw:pl-3.5'
  ),
  success: 'tw:pt-3 tw:pr-3.5 tw:pb-3.5 tw:pl-5.5 tw:dark:bg-primary',
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

const ChangeColumn = ({
  title,
  values,
  kept,
  tone,
  isText,
}: ChangeColumnProps) => (
  <Box
    className={classNames('tw:min-w-0 tw:flex-1', COLUMN_TONE_CLASS[tone])}
    data-testid={`activity-change-${tone}`}
    direction="col"
    gap={2}>
    <Typography className="tw:text-secondary" size="text-xs" weight="medium">
      {title}
    </Typography>
    {isText ? (
      <RichTextEditorPreviewerV1
        className="tw:text-sm tw:text-secondary"
        markdown={values[0]}
      />
    ) : (
      <Box className="tw:gap-1.5" wrap="wrap">
        {keyValues(kept).map(({ value, key }) => (
          <Badge color="gray" key={`kept-${key}`} size="sm" type="color">
            {value}
          </Badge>
        ))}
        {keyValues(values).map(({ value, key }) => (
          <Badge color={tone} key={key} size="sm" type="color">
            {`${CHANGE_SIGN[tone]} ${value}`}
          </Badge>
        ))}
      </Box>
    )}
  </Box>
);

// The field a change is to, and how many values it gains and loses.
const ChangeHeader = ({
  label,
  added,
  removed,
  isText,
}: {
  label: string;
  added: number;
  removed: number;
  isText: boolean;
}) => (
  <Box
    align="center"
    className="tw:h-9 tw:border-b tw:border-secondary tw:px-3.5"
    gap={2}>
    <Typography className="tw:text-secondary" size="text-xs" weight="semibold">
      {label}
    </Typography>
    {!isText && added > 0 && (
      <Badge color="success" size="sm" type="color">
        {`+${added}`}
      </Badge>
    )}
    {!isText && removed > 0 && (
      <Badge color="error" size="sm" type="color">
        {`−${removed}`}
      </Badge>
    )}
  </Box>
);

/**
 * The card's change panel: the field, how many values it gained or lost, and
 * what was removed beside what was added, with any values it keeps on both
 * sides. A side shows only when it has something, since an event records the
 * change, not the full list.
 */
const ActivityChangePanel = ({ change }: { change: ActivityChange }) => {
  const { t } = useTranslation();
  const { labelKey, before, after, isText, unchanged = [] } = change;
  // Kept values belong to both sides, so either shows when there are any.
  const showBefore = before.length > 0 || unchanged.length > 0;
  const showAfter = after.length > 0 || unchanged.length > 0;

  return (
    // A bordered surface of its own, not a layout Box: on a hovered activity
    // card it takes a background (ACTIVITY_CARD_PANEL_HOVER_CLASS).
    <div
      className={classNames(
        'tw:flex tw:flex-col tw:overflow-hidden tw:rounded-lg tw:border tw:border-secondary',
        ACTIVITY_CARD_PANEL_HOVER_CLASS
      )}
      data-testid="activity-change-panel">
      <ChangeHeader
        added={after.length}
        isText={isText}
        label={t(labelKey)}
        removed={before.length}
      />
      {/* Top-aligned columns split by a rule, the arrow sitting on it. */}
      <Box className="tw:relative tw:divide-x tw:divide-secondary">
        {showBefore && (
          <ChangeColumn
            isText={isText}
            kept={unchanged}
            title={t('label.existing')}
            tone="error"
            values={before}
          />
        )}
        {showBefore && showAfter && (
          <span
            aria-hidden
            className={classNames(
              'tw:absolute tw:top-1/2 tw:left-1/2 tw:flex tw:size-6 tw:-translate-1/2 tw:items-center tw:justify-center',
              'tw:rounded-full tw:border tw:border-secondary tw:bg-primary tw:shadow-xs'
            )}>
            <ArrowRight className="tw:size-3.5 tw:text-quaternary" />
          </span>
        )}
        {showAfter && (
          <ChangeColumn
            isText={isText}
            kept={unchanged}
            title={t('label.suggested')}
            tone="success"
            values={after}
          />
        )}
      </Box>
    </div>
  );
};

export default ActivityChangePanel;
