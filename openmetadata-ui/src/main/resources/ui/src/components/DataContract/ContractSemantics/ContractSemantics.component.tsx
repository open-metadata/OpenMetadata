/*
 *  Copyright 2025 Collate.
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
  Card,
  Divider,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  CheckCircle,
  MinusCircle,
  XCircle,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as InheritIcon } from '../../../assets/svg/ic-inherit.svg';
import { SemanticsRule } from '../../../generated/entity/data/dataContract';
import { DataContractResult } from '../../../generated/entity/datacontract/dataContractResult';
import { getContractStatusType } from '../../../utils/DataContract/DataContractUtils';
import { stripMarkdown } from '../../../utils/RichTextStringUtils';
import StatusBadgeV2 from '../../common/StatusBadge/StatusBadgeV2.component';

// The full text shows on hover only when it is cut off; rows add no tab stops.
const ELLIPSIS_WITH_TOOLTIP = {
  tooltip: true,
  excludeTriggerFromTabOrder: true,
};

const RULE_STATUS = {
  notRun: {
    Icon: MinusCircle,
    iconClassName: 'tw:text-fg-quaternary',
    status: 'not-run',
  },
  failed: {
    Icon: XCircle,
    iconClassName: 'tw:text-fg-error-secondary',
    status: 'failed',
  },
  passed: {
    Icon: CheckCircle,
    iconClassName: 'tw:text-fg-success-secondary',
    status: 'passed',
  },
};

const ContractSemantics: React.FC<{
  semantics: SemanticsRule[];
  latestContractResults?: DataContractResult;
  contractStatus?: string;
}> = ({ semantics, latestContractResults, contractStatus }) => {
  const { t } = useTranslation();

  const getRuleStatus = (semantic: SemanticsRule) => {
    // A disabled rule is skipped by validation, so the last run did not pass it
    if (!latestContractResults || !semantic.enabled) {
      return RULE_STATUS.notRun;
    }
    const isRuleFailed =
      latestContractResults?.semanticsValidation?.failedRules?.find(
        (rule) => rule.ruleName === semantic.name
      );

    return isRuleFailed ? RULE_STATUS.failed : RULE_STATUS.passed;
  };

  return (
    <Card data-testid="contract-semantics" size="sm">
      <Card.Content>
        <Box align="start" gap={6}>
          <Box className="tw:min-w-0 tw:flex-1" direction="col">
            {semantics.map((item, index) => {
              const { Icon, iconClassName, status } = getRuleStatus(item);
              const description = stripMarkdown(item.description ?? '');

              return (
                <Fragment key={item.rule}>
                  {index > 0 && <Divider />}
                  <Box
                    align="center"
                    className="tw:min-w-0 tw:py-2"
                    data-testid="semantic-rule-item"
                    gap={3}>
                    <Icon
                      className={classNames(
                        'tw:size-5 tw:shrink-0',
                        iconClassName
                      )}
                      data-status={status}
                      data-testid="semantic-rule-icon"
                    />
                    {/* The name keeps up to 40% of the row; the description takes the rest. */}
                    <div className="tw:min-w-0 tw:max-w-[40%] tw:shrink-0">
                      <Typography
                        data-testid="semantic-rule-name"
                        ellipsis={ELLIPSIS_WITH_TOOLTIP}
                        size="text-md"
                        weight="semibold">
                        {item.name}
                      </Typography>
                    </div>
                    {item.inherited && (
                      <Tooltip
                        arrow
                        excludeTriggerFromTabOrder
                        title={t('label.inherited-entity', {
                          entity: t('label.semantic-plural'),
                        })}
                        triggerClassName="tw:inline-flex tw:shrink-0">
                        <InheritIcon
                          className="inherit-icon tw:cursor-pointer"
                          width={14}
                        />
                      </Tooltip>
                    )}
                    {description && (
                      <>
                        <Divider
                          className="tw:h-5 tw:self-center"
                          orientation="vertical"
                        />
                        <div className="tw:min-w-0 tw:flex-1">
                          <Typography
                            color="secondary"
                            data-testid="semantic-rule-description"
                            ellipsis={ELLIPSIS_WITH_TOOLTIP}
                            size="text-md">
                            {description}
                          </Typography>
                        </div>
                      </>
                    )}
                  </Box>
                </Fragment>
              );
            })}
          </Box>
          {contractStatus && (
            <Box align="center" className="tw:shrink-0 tw:py-2" gap={3}>
              <Typography color="secondary" size="text-md">
                {t('label.entity-status', {
                  entity: t('label.semantic-plural'),
                })}
              </Typography>
              <StatusBadgeV2
                dataTestId="contract-status-card-item-semantics-status"
                label={contractStatus}
                status={getContractStatusType(contractStatus)}
              />
            </Box>
          )}
        </Box>
      </Card.Content>
    </Card>
  );
};

export default ContractSemantics;
