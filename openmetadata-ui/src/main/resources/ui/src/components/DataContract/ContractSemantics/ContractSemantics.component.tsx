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
import { Box, Tooltip, Typography } from '@openmetadata/ui-core-components';
import {
  CheckCircle,
  MinusCircle,
  XCircle,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { ReactComponent as InheritIcon } from '../../../assets/svg/ic-inherit.svg';
import { SemanticsRule } from '../../../generated/entity/data/dataContract';
import { DataContractResult } from '../../../generated/entity/datacontract/dataContractResult';
import { getContractStatusType } from '../../../utils/DataContract/DataContractUtils';
import RichTextEditorPreviewerNew from '../../common/RichTextEditor/RichTextEditorPreviewNew';
import StatusBadgeV2 from '../../common/StatusBadge/StatusBadgeV2.component';
import './contract-semantics.less';

const ContractSemantics: React.FC<{
  semantics: SemanticsRule[];
  latestContractResults?: DataContractResult;
  contractStatus?: string;
}> = ({ semantics, latestContractResults, contractStatus }) => {
  const { t } = useTranslation();

  const getSemanticIconPerLastExecution = (semantic: SemanticsRule) => {
    // A disabled rule is skipped by validation, so the last run did not pass it
    if (!latestContractResults || !semantic.enabled) {
      return MinusCircle;
    }
    const isRuleFailed =
      latestContractResults?.semanticsValidation?.failedRules?.find(
        (rule) => rule.ruleName === semantic.name
      );

    return isRuleFailed ? XCircle : CheckCircle;
  };

  return (
    <div className="contract-semantic-component-container">
      <div className="rule-item-container">
        {semantics.map((item) => {
          const inheritedIcon = item.inherited ? (
            <Tooltip
              arrow
              excludeTriggerFromTabOrder
              title={t('label.inherited-entity', {
                entity: t('label.semantic-plural'),
              })}
              triggerClassName="tw:inline-flex">
              <InheritIcon
                className="inherit-icon tw:cursor-pointer"
                width={14}
              />
            </Tooltip>
          ) : null;
          const RuleIcon = getSemanticIconPerLastExecution(item);

          return (
            <div className="rule-item" key={item.rule}>
              {/* One size for every status; 20px matches the rule name's line height. */}
              <RuleIcon
                className={classNames(
                  'rule-icon tw:mt-px tw:size-5 tw:shrink-0',
                  {
                    'rule-icon-default tw:text-fg-quaternary':
                      RuleIcon === MinusCircle,
                    'tw:text-fg-error-secondary': RuleIcon === XCircle,
                    'tw:text-fg-success-secondary': RuleIcon === CheckCircle,
                  }
                )}
              />
              <div className="rule-item-content">
                <div className="d-flex items-center gap-1">
                  <Typography className="rule-name">{item.name}</Typography>
                  {inheritedIcon}
                </div>
                <Typography className="rule-description">
                  <RichTextEditorPreviewerNew
                    enableSeeMoreVariant
                    markdown={item.description}
                    maxLineLength="3"
                  />
                </Typography>
              </div>
            </div>
          );
        })}
      </div>
      {contractStatus && (
        <Box
          align="center"
          className="contract-status-container tw:self-start"
          gap={3}>
          <Typography className="contract-status-label">{`${t(
            'label.entity-status',
            {
              entity: t('label.semantic-plural'),
            }
          )} :`}</Typography>
          <StatusBadgeV2
            dataTestId="contract-status-card-item-semantics-status"
            label={contractStatus}
            status={getContractStatusType(contractStatus)}
          />
        </Box>
      )}
    </div>
  );
};

export default ContractSemantics;
