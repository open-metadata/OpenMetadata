/*
 *  Copyright 2024 Collate.
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
  Grid,
  Select,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import { XClose } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import { Effect } from '../../generated/events/eventSubscription';
import { useAlertSelectionContext } from '../../hooks/useAlertSelection';
import { getLayoutGutter } from '../../utils/common/layout.utils';
import FormCardSection from '../common/FormCardSection/FormCardSection';
import { RuleSectionProps } from '../observability/Alerts/AlertAiFormFields.interface';
import {
  getRuleCopy,
  getRulesWithAddedRule,
  getRulesWithEffect,
  getRulesWithName,
  getRulesWithoutIndex,
  getRuntimeArguments,
  getValidationPath,
  updateAlertAiValue,
} from '../observability/Alerts/AlertAiFormFieldsPureUtils';
import { RuleArgumentField } from '../observability/Alerts/AlertAiRuleSection.component';
import { getClassicRuleItems } from './ClassicAlertRuleSection.utils';
import FQNListSelect from './FQNListSelect/FQNListSelect.component';
import { useAlertRuleKeys } from './useAlertRuleKeys';

const ARGUMENT_TEST_IDS: Record<string, string> = {
  fqnList: 'fqn-list-select',
  domainList: 'domain-select',
  tableNameList: 'table-name-select',
  entityNameList: 'entity-name-select',
  ownerNameList: 'owner-name-select',
  updateByUserList: 'user-name-select',
  userList: 'user-name-select',
  entityIdList: 'entity-id-select',
  testSuiteList: 'test-suite-select',
  eventTypeList: 'event-type-select',
  pipelineStateList: 'pipeline-status-select',
  ingestionPipelineStateList: 'pipeline-status-select',
  testStatusList: 'test-status-select',
  testResultList: 'test-result-select',
  contractStatusList: 'contract-status-select',
};

export const ClassicAlertRuleSection = ({
  field,
  title,
  isViewOnly = false,
  value,
  onChange,
  validationErrors,
}: RuleSectionProps) => {
  const { t } = useTranslation();
  const { sources, support, search } = useAlertSelectionContext();
  const supportedRules =
    field === 'filters' ? support.supportedFilters : support.supportedTriggers;
  const rules = value.input?.[field] ?? [];
  const copy = getRuleCopy(field, t);
  const items = getClassicRuleItems(supportedRules, rules);
  const { keys, removeKey } = useAlertRuleKeys(rules.length);
  const prefix = field === 'filters' ? 'filter' : 'trigger';
  const changeRules = (nextRules: typeof rules) =>
    updateAlertAiValue(value, onChange, ['input', field], nextRules);

  return (
    <FormCardSection heading={title} subHeading={copy.description}>
      <Grid
        className="layout-row layout-grid"
        data-testid={field === 'filters' ? 'filters-list' : 'triggers-list'}
        style={getLayoutGutter(16, 16)}>
        {rules.map((rule, ruleIndex) => {
          const error =
            validationErrors?.[
              getValidationPath('input', field, ruleIndex, 'name')
            ];
          const argumentsToRender = getRuntimeArguments(rule, supportedRules);

          return (
            <Grid.Item
              className="layout-column"
              data-testid={prefix + '-' + ruleIndex}
              key={keys[ruleIndex] ?? prefix + '-' + ruleIndex}
              span={24}>
              <Box gap={4}>
                <Box className="tw:min-w-0 tw:flex-1" direction="col" gap={6}>
                  <Grid
                    className="layout-row layout-grid"
                    style={getLayoutGutter(8, 8)}>
                    <Grid.Item className="layout-column" span={12}>
                      <Select
                        aria-label={copy.label}
                        data-testid={prefix + '-select-' + ruleIndex}
                        fontSize="sm"
                        hint={error}
                        isDisabled={isViewOnly}
                        isInvalid={Boolean(error)}
                        items={items}
                        placeholder={copy.placeholder}
                        selectedKey={rule.name || null}
                        onSelectionChange={(key) => {
                          if (key !== null) {
                            changeRules(
                              getRulesWithName({
                                index: ruleIndex,
                                ruleName: String(key),
                                selectedRules: rules,
                                supportedRules,
                              })
                            );
                          }
                        }}>
                        {(item) => (
                          <Select.Item
                            data-testid={
                              (item.label ?? item.id) + '-filter-option'
                            }
                            id={item.id}
                            isDisabled={item.isDisabled}>
                            {item.label}
                          </Select.Item>
                        )}
                      </Select>
                    </Grid.Item>
                    {argumentsToRender.map((argument, index) => (
                      <Grid.Item
                        className="layout-column"
                        key={argument}
                        span={12}>
                        <Box className="tw:[&_label]:sr-only">
                          {argument === 'fqnList' ? (
                            <FQNListSelect
                              api={search.byName}
                              containerEntities={search.containerEntities}
                              data-testid="fqn-list-select"
                              hint={
                                validationErrors?.[
                                  getValidationPath(
                                    'input',
                                    field,
                                    ruleIndex,
                                    'arguments',
                                    index,
                                    'input'
                                  )
                                ]
                              }
                              isDisabled={isViewOnly}
                              placeholder={t('label.search-by-type', {
                                type: t('label.fqn-uppercase'),
                              })}
                              searchIndex={search.indexes}
                              value={rule.arguments?.[index]?.input ?? []}
                              onChange={(next) =>
                                updateAlertAiValue(
                                  value,
                                  onChange,
                                  [
                                    'input',
                                    field,
                                    ruleIndex,
                                    'arguments',
                                    index,
                                    'input',
                                  ],
                                  next
                                )
                              }
                            />
                          ) : (
                            <RuleArgumentField
                              argument={argument}
                              field={field}
                              index={index}
                              isViewOnly={isViewOnly}
                              name={ruleIndex}
                              sourceSearch={search}
                              supportedEventTypes={support.supportedEventTypes}
                              testId={ARGUMENT_TEST_IDS[argument]}
                              validationErrors={validationErrors}
                              value={value}
                              onChange={onChange}
                            />
                          )}
                        </Box>
                      </Grid.Item>
                    ))}
                  </Grid>
                  <Box align="center" gap={2}>
                    <Typography>{t('label.include')}</Typography>
                    <Toggle
                      aria-label={t('label.include')}
                      data-testid={prefix + '-switch-' + ruleIndex}
                      isDisabled={isViewOnly}
                      isSelected={rule.effect !== Effect.Exclude}
                      size="sm"
                      onChange={(included) =>
                        changeRules(
                          getRulesWithEffect(rules, ruleIndex, included)
                        )
                      }
                    />
                  </Box>
                </Box>
                {!isViewOnly && (
                  <Button
                    aria-label={t('label.remove-entity', {
                      entity: copy.label,
                    })}
                    data-testid={'remove-' + prefix + '-' + ruleIndex}
                    iconLeading={XClose}
                    size="sm"
                    onPress={() => {
                      removeKey(ruleIndex);
                      changeRules(getRulesWithoutIndex(rules, ruleIndex));
                    }}
                  />
                )}
              </Box>
            </Grid.Item>
          );
        })}
        {!isViewOnly && rules.length < (supportedRules?.length ?? 1) && (
          <Grid.Item className="layout-column" span={24}>
            <Button
              color="primary"
              data-testid={field === 'filters' ? 'add-filters' : 'add-trigger'}
              isDisabled={sources.length === 0}
              size="sm"
              onPress={() => changeRules(getRulesWithAddedRule(rules))}>
              {t('label.add-entity', { entity: copy.label })}
            </Button>
          </Grid.Item>
        )}
      </Grid>
    </FormCardSection>
  );
};
