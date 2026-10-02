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
  Box,
  Button,
  Divider,
  Dot,
  Dropdown,
  Typography,
} from '@openmetadata/ui-core-components';
import { CheckCircle } from '@openmetadata/ui-core-components/icons';
import { startCase } from 'lodash';
import { useTranslation } from 'react-i18next';
import { TEST_CASE_RESOLUTION_STATUS_LABELS } from '../../../../constants/TestSuite.constant';
import { Severities as CreateSeverities } from '../../../../generated/api/tests/createTestCaseResolutionStatus';
import { TestCaseResolutionStatusTypes } from '../../../../generated/tests/testCaseResolutionStatus';
import {
  BULK_INCIDENT_STATUSES,
  BULK_INCIDENT_STATUS_DOT_CLASS,
} from './IncidentGroups.constants';
import {
  BulkIncidentStatus,
  IncidentGroupsSelectionBarProps,
} from './IncidentGroups.types';

const SECTION_HEADER_CLASS =
  'tw:px-4 tw:py-1.5 tw:text-xs tw:font-semibold tw:text-quaternary tw:uppercase';

/**
 * What can be done to the selected groups: move all their open incidents to
 * one status, or to one severity, or drop the selection.
 */
const IncidentGroupsSelectionBar = ({
  selectedCount,
  incidentCount,
  isApplying,
  onSetStatus,
  onSetSeverity,
  onClearSelection,
}: IncidentGroupsSelectionBarProps) => {
  const { t } = useTranslation();

  return (
    <Box
      align="center"
      className="tw:rounded-xl tw:border tw:border-brand-subtle tw:bg-brand-primary tw:px-4 tw:py-2"
      data-testid="incident-groups-selection-bar"
      gap={3}>
      <CheckCircle className="tw:size-5 tw:text-fg-brand-primary" />
      <Typography
        as="span"
        className="tw:text-brand-secondary"
        data-testid="incident-groups-selected-count"
        size="text-sm"
        weight="semibold">
        {`${selectedCount} ${t(
          selectedCount === 1
            ? 'label.group-lowercase'
            : 'label.group-lowercase-plural'
        )} ${t('label.selected-lowercase')}`}
      </Typography>
      <Typography
        as="span"
        className="tw:text-tertiary"
        data-testid="incident-groups-selected-incidents"
        size="text-sm">
        {`${incidentCount} ${t(
          incidentCount === 1
            ? 'label.incident-lowercase'
            : 'label.incident-lowercase-plural'
        )}`}
      </Typography>
      <Divider className="tw:h-4" orientation="vertical" />
      <Dropdown.Root>
        <Button
          showTextWhileLoading
          color="secondary"
          data-testid="incident-groups-set-status"
          isDisabled={isApplying}
          isLoading={isApplying}
          size="sm">
          {t('label.set-status')}
        </Button>
        <Dropdown.Popover
          className="tw:w-max tw:min-w-48"
          placement="bottom left">
          <Dropdown.Menu
            onAction={(key) => onSetStatus(key as BulkIncidentStatus)}>
            <Dropdown.Section>
              <Dropdown.SectionHeader className={SECTION_HEADER_CLASS}>
                {t('label.set-status-to')}
              </Dropdown.SectionHeader>
              {BULK_INCIDENT_STATUSES.map((status) => {
                const label =
                  TEST_CASE_RESOLUTION_STATUS_LABELS[
                    status as unknown as TestCaseResolutionStatusTypes
                  ];

                return (
                  <Dropdown.Item
                    data-testid={`incident-groups-status-${status}`}
                    id={status}
                    key={status}
                    textValue={label}>
                    <Box inline align="center" gap={2}>
                      <Dot
                        aria-hidden="true"
                        className={BULK_INCIDENT_STATUS_DOT_CLASS[status]}
                        size="md"
                      />
                      {label}
                    </Box>
                  </Dropdown.Item>
                );
              })}
            </Dropdown.Section>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
      <Dropdown.Root>
        <Button
          color="secondary"
          data-testid="incident-groups-set-severity"
          isDisabled={isApplying}
          size="sm">
          {t('label.set-severity')}
        </Button>
        <Dropdown.Popover
          className="tw:w-max tw:min-w-48"
          placement="bottom left">
          <Dropdown.Menu
            onAction={(key) => onSetSeverity(key as CreateSeverities)}>
            <Dropdown.Section>
              <Dropdown.SectionHeader className={SECTION_HEADER_CLASS}>
                {t('label.set-severity-to')}
              </Dropdown.SectionHeader>
              {Object.values(CreateSeverities).map((severity) => (
                <Dropdown.Item
                  data-testid={`incident-groups-severity-${severity}`}
                  id={severity}
                  key={severity}
                  label={startCase(severity)}
                />
              ))}
            </Dropdown.Section>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
      <Button
        className="tw:ml-auto"
        color="link-gray"
        data-testid="incident-groups-clear-selection"
        size="sm"
        onPress={onClearSelection}>
        {t('label.clear-selection')}
      </Button>
    </Box>
  );
};

export default IncidentGroupsSelectionBar;
