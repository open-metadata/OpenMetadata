/*
 *  Copyright 2023 Collate.
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

import { Dropdown, Typography } from '@openmetadata/ui-core-components';
import { startCase } from 'lodash';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SEVERITY_COLORS } from '../../../../constants/Color.constants';
import { Severities } from '../../../../generated/tests/testCaseResolutionStatus';
import { ChipTrigger } from '../TestCaseStatus/InlineIncidentStatus/ChipTrigger.component';
import { InlineSeverityProps } from './Severity.interface';

const SELECTED_ITEM_CLASS =
  'tw:[&[data-selected]>div]:!bg-brand-solid tw:[&[data-selected]>div_*]:!text-white';

/**
 * Budget for the Severity column, not for chips in general (issue #30522).
 *
 * ru-RU composes this placeholder as "Критичность инцидента отсутствует" — 218px
 * of rendered text against 67px for English "No Severity". Unbounded, the chip
 * reached 258px and widened the column to 306px, pushing the Assignee column's
 * right edge to 1508px at a 1440px viewport.
 *
 * 176px is the widest Tailwind step that keeps Assignee on screen: measured on
 * the live pill at 1440px with the nav expanded, 176px lands the edge at 1430px
 * and 184px at 1438px, while 188px already overruns at 1442px and `max-w-48`
 * (192px) at 1446px. It also clears every
 * non-Russian severity placeholder (widest 168.6px, pt-BR), so exactly one
 * locale truncates — the one that motivated the fix.
 *
 * All widths measured in-DOM at Inter 12px/500 across the 20 shipped locales. An
 * off-DOM probe under-reports Cyrillic by ~6px because the `unicode-range`
 * subset is not active for glyphs it never paints; do not size this from one.
 */
const SEVERITY_CHIP_MAX_WIDTH = 'tw:max-w-44';

const InlineSeverity = ({
  severity,
  hasEditPermission,
  onSubmit,
}: InlineSeverityProps) => {
  const { t } = useTranslation();
  const chipRef = useRef<HTMLButtonElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const severityKey = severity ?? 'NoSeverity';
  const severityColor =
    SEVERITY_COLORS[severityKey] ?? SEVERITY_COLORS['NoSeverity'];
  const noSeverityLabel = t('label.no-entity', { entity: t('label.severity') });
  const label = severity ? startCase(severity) : noSeverityLabel;

  const palette = {
    bg: severityColor.bg,
    border: severityColor.color,
    color: severityColor.color,
  };

  const handleSeverityChange = useCallback(
    async (newSeverity: Severities | undefined) => {
      setShowMenu(false);
      setIsLoading(true);
      try {
        await onSubmit?.(newSeverity);
      } finally {
        setIsLoading(false);
      }
    },
    [onSubmit]
  );

  const chipTrigger = (
    <ChipTrigger
      attachPressHandler={false}
      chipLabel={label}
      chipRef={chipRef}
      dataTestId="severity-chip"
      hasEditPermission={hasEditPermission && !isLoading}
      maxChipWidth={SEVERITY_CHIP_MAX_WIDTH}
      overlayOpen={showMenu}
      palette={palette}
    />
  );

  if (!hasEditPermission) {
    return <div className="tw:inline-flex tw:items-center">{chipTrigger}</div>;
  }

  return (
    <div className="tw:inline-flex tw:items-center">
      <Dropdown.Root onOpenChange={setShowMenu}>
        {chipTrigger}
        <Dropdown.Popover className="tw:w-max" placement="top">
          <Dropdown.Menu
            selectedKeys={severity ? [severity] : ['none']}
            selectionMode="single"
            onAction={(key) =>
              handleSeverityChange(
                key === 'none' ? undefined : (key as Severities)
              )
            }>
            <Dropdown.Item
              className={SELECTED_ITEM_CLASS}
              id="none"
              textValue={noSeverityLabel}>
              <Typography as="span" size="text-sm" weight="regular">
                {noSeverityLabel}
              </Typography>
            </Dropdown.Item>
            <Dropdown.Separator />
            {Object.values(Severities).map((sev) => (
              <Dropdown.Item
                className={SELECTED_ITEM_CLASS}
                id={sev}
                key={sev}
                textValue={startCase(sev)}>
                <Typography as="span" size="text-sm" weight="regular">
                  {startCase(sev)}
                </Typography>
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
    </div>
  );
};

export default InlineSeverity;
