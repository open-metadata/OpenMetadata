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
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Copy01,
  InfoCircle,
  XCircle,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { startCase } from 'lodash';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StepValidation } from '../../../../../../generated/system/validationResponse';
import { useClipboard } from '../../../../../../hooks/useClipBoard';

const STATUS_STYLES = {
  passed: {
    border: 'tw:border-success-subtle',
    background: 'tw:bg-success-primary',
    text: 'tw:text-success-primary',
    icon: CheckCircle,
    labelKey: 'label.success',
    testId: 'success-badge',
  },
  failed: {
    border: 'tw:border-error-subtle',
    background: 'tw:bg-error-primary',
    text: 'tw:text-error-primary',
    icon: XCircle,
    labelKey: 'label.failed',
    testId: 'fail-badge',
  },
};

const HealthCheckLogs = ({ logs }: { logs: string }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const { onCopyToClipBoard } = useClipboard(logs);

  return (
    <>
      <Button
        className="tw:self-start"
        color="link-color"
        data-testid="toggle-logs"
        iconTrailing={isOpen ? ChevronUp : ChevronDown}
        size="sm"
        onPress={() => setIsOpen((prev) => !prev)}>
        {isOpen ? t('label.hide-log-plural') : t('label.show-log-plural')}
      </Button>
      {isOpen && (
        <Box
          className="tw:rounded-lg tw:bg-primary-solid"
          data-testid="health-check-logs"
          direction="col">
          <Box
            align="center"
            className="tw:border-b tw:border-white/10 tw:px-4 tw:py-2"
            direction="row"
            justify="between">
            <Typography
              className="tw:text-white tw:uppercase"
              size="text-xs"
              weight="medium">
              {t('label.log-plural')}
            </Typography>
            <Button
              color="tertiary"
              data-testid="copy-logs"
              iconLeading={Copy01}
              size="sm"
              onPress={() => onCopyToClipBoard()}>
              {t('label.copy')}
            </Button>
          </Box>
          <pre className="tw:m-0 tw:max-h-75 tw:overflow-auto tw:whitespace-pre-wrap tw:break-all tw:p-4 tw:font-mono tw:text-xs tw:text-white">
            {logs}
          </pre>
        </Box>
      )}
    </>
  );
};

interface HealthCheckCardProps {
  name: string;
  validation: StepValidation;
}

/**
 * One `/system/status` step. A passing step shows its message; a failing one
 * shows the step description, with the server message available as logs.
 */
const HealthCheckCard = ({ name, validation }: HealthCheckCardProps) => {
  const { t } = useTranslation();
  const passed = Boolean(validation.passed);
  const status = STATUS_STYLES[passed ? 'passed' : 'failed'];
  const StatusIcon = status.icon;
  const logs = passed ? undefined : validation.message;

  return (
    <Box
      className={classNames(
        'tw:overflow-hidden tw:rounded-[10px] tw:border',
        status.border
      )}
      data-testid={name}
      direction="col">
      <Box
        align="center"
        className={classNames('tw:px-5 tw:py-3', status.background)}
        direction="row"
        justify="between">
        <Box align="center" direction="row" gap={1}>
          <Typography
            className="tw:text-primary"
            size="text-sm"
            weight="semibold">
            {startCase(name)}
          </Typography>
          <Typography className="tw:text-error-primary" size="text-sm">
            *
          </Typography>
          {validation.description && (
            <Tooltip
              title={validation.description}
              triggerClassName="tw:inline-flex tw:items-center">
              <InfoCircle className="tw:size-4 tw:text-tertiary" />
            </Tooltip>
          )}
        </Box>
        <Box
          align="center"
          className={status.text}
          data-testid={status.testId}
          direction="row"
          gap={1}>
          <StatusIcon className="tw:size-4" />
          <Typography size="text-sm" weight="medium">
            {t(status.labelKey)}
          </Typography>
        </Box>
      </Box>

      <Box className="tw:px-5 tw:py-4" direction="col" gap={3}>
        <Typography
          className="tw:font-mono tw:text-secondary tw:break-all"
          data-testid="health-check-message"
          size="text-sm">
          {passed ? validation.message : validation.description}
        </Typography>
        {logs && <HealthCheckLogs logs={logs} />}
      </Box>
    </Box>
  );
};

export default HealthCheckCard;
