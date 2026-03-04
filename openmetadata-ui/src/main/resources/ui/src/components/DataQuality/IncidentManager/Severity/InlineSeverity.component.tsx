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
import {
  ChevronDown as ArrowDownIcon,
  ChevronUp as ArrowUpIcon,
} from '@untitledui/icons';
import classNames from 'classnames';
import { startCase, toLower } from 'lodash';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SEVERITY_COLORS } from '../../../../constants/Color.constants';
import { Severities } from '../../../../generated/tests/testCaseResolutionStatus';
import { InlineSeverityProps } from './Severity.interface';

const InlineSeverity = ({
  severity,
  hasEditPermission,
  onSubmit,
}: InlineSeverityProps) => {
  const { t } = useTranslation();
  const [showMenu, setShowMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const severityKey = severity ?? 'NoSeverity';
  const severityColor =
    SEVERITY_COLORS[severityKey] ?? SEVERITY_COLORS['NoSeverity'];
  const label = severity
    ? startCase(severity)
    : t('label.no-entity', { entity: t('label.severity') });

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

  const chipButton = (
    <button
      className={classNames(
        'severity tw:inline-flex tw:items-center tw:gap-1 tw:rounded-2xl tw:border tw:px-2 tw:py-0.5',
        severity && toLower(severity)
      )}
      data-testid="severity-chip"
      disabled={!hasEditPermission || isLoading}
      style={{
        backgroundColor: severityColor.bg,
        borderColor: severityColor.color,
        color: severityColor.color,
        cursor: hasEditPermission && !isLoading ? 'pointer' : 'default',
      }}
      type="button">
      <Typography as="span" className="tw:px-0.5 tw:text-xs tw:font-medium">
        {label}
      </Typography>
      {hasEditPermission &&
        (showMenu ? (
          <ArrowUpIcon className="tw:size-4 tw:shrink-0" />
        ) : (
          <ArrowDownIcon className="tw:size-4 tw:shrink-0" />
        ))}
    </button>
  );

  if (!hasEditPermission) {
    return <div className="tw:inline-flex tw:items-center">{chipButton}</div>;
  }

  return (
    <div className="tw:inline-flex tw:items-center">
      <Dropdown.Root onOpenChange={setShowMenu}>
        {chipButton}
        <Dropdown.Popover className="tw:w-max">
          <Dropdown.Menu
            selectedKeys={severity ? [severity] : ['none']}
            selectionMode="single"
            onAction={(key) =>
              handleSeverityChange(
                key === 'none' ? undefined : (key as Severities)
              )
            }>
            <Dropdown.Item
              id="none"
              label={t('label.no-entity', { entity: t('label.severity') })}
            />
            <Dropdown.Separator />
            {Object.values(Severities).map((sev) => (
              <Dropdown.Item id={sev} key={sev} label={startCase(sev)} />
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
    </div>
  );
};

export default InlineSeverity;
