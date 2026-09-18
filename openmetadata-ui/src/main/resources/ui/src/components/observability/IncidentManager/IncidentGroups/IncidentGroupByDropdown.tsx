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

import { Button, Dropdown } from '@openmetadata/ui-core-components';
import { ChevronDown } from '@openmetadata/ui-core-components/icons';
// LayersTwo01 has no counterpart in the core-components icon barrel, which only
// re-exports the design team's own SVG set.
// eslint-disable-next-line no-restricted-imports
import { LayersTwo01 } from '@untitledui/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IncidentGroupBy } from '../../../../generated/tests/testCaseIncidentGroup';
import { INCIDENT_GROUP_BY_OPTIONS } from './IncidentGroups.constants';
import { IncidentGroupByDropdownProps } from './IncidentGroups.types';

/**
 * Dimension picker for the grouped incident listing. The selected dimension is
 * owned by the caller (and, through it, by the URL).
 */
const IncidentGroupByDropdown = ({
  value,
  onChange,
}: IncidentGroupByDropdownProps) => {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const selectedOption =
    INCIDENT_GROUP_BY_OPTIONS.find((option) => option.key === value) ??
    INCIDENT_GROUP_BY_OPTIONS[0];

  return (
    <Dropdown.Root isOpen={isMenuOpen} onOpenChange={setIsMenuOpen}>
      <Button
        color="secondary"
        data-testid="incident-group-by-button"
        iconLeading={<LayersTwo01 className="tw:size-4" />}
        iconTrailing={<ChevronDown className="tw:size-4" />}
        size="sm">
        <span className="tw:font-normal tw:text-tertiary">
          {`${t('label.group-by')} `}
        </span>
        <span data-testid="incident-group-by-value">
          {t(selectedOption.labelKey)}
        </span>
      </Button>
      <Dropdown.Popover className="tw:w-max tw:min-w-50">
        <Dropdown.Menu
          selectedKeys={[value]}
          selectionMode="single"
          onAction={(key) => {
            onChange(key as IncidentGroupBy);
            setIsMenuOpen(false);
          }}>
          <Dropdown.Section>
            <Dropdown.SectionHeader className="tw:px-4 tw:py-1.5 tw:text-xs tw:font-semibold tw:text-quaternary tw:uppercase">
              {t('message.group-incidents-by')}
            </Dropdown.SectionHeader>
            {INCIDENT_GROUP_BY_OPTIONS.map((option) => (
              <Dropdown.Item
                data-testid={`incident-group-by-option-${option.key}`}
                icon={option.icon}
                id={option.key}
                key={option.key}
                label={t(option.labelKey)}
              />
            ))}
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

export default IncidentGroupByDropdown;
