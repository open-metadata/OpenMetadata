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
  const label = severity
    ? startCase(severity)
    : t('label.no-entity', { entity: t('label.severity') });

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
              textValue={t('label.no-entity', { entity: t('label.severity') })}>
              <Typography as="span" size="text-sm" weight="regular">
                {t('label.no-entity', { entity: t('label.severity') })}
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
