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
  Autocomplete,
  Box,
  Button,
  Input,
  Select,
  SelectItemType,
  Toggle,
} from '@openmetadata/ui-core-components';
import { Trash01 } from '@untitledui/icons';
import classNames from 'classnames';
import { debounce, isEmpty, uniqBy } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Key } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Effect } from '../../../generated/events/eventSubscription';
import {
  ALERT_AI_FORM_CLASS_NAMES,
  SEARCHABLE_ARGUMENTS,
} from './AlertAiFormFields.constants';
import {
  AiArgumentAutocompleteProps,
  AiArgumentMultiSelectProps,
  AiArgumentTextInputProps,
  RuleArgumentFieldProps,
  RuleSectionProps,
} from './AlertAiFormFields.interface';
import {
  getArgumentPath,
  getCommaSeparatedStringArray,
  getCommaSeparatedValues,
  getListValue,
  getRuleCopy,
  getRuleItems,
  getRulesWithAddedRule,
  getRulesWithEffect,
  getRulesWithName,
  getRulesWithoutIndex,
  getRuntimeArguments,
  getTextArgumentCopy,
  getValidationPath,
  updateAlertAiValue,
} from './AlertAiFormFieldsPureUtils';
import { searchAlertAiArgumentOptions } from './AlertAiFormFieldsSearchUtils';
import {
  getSelectArgumentConfig,
  renderSelectItem,
} from './AlertAiFormFieldsSelectUtils';
import AlertAiSection from './AlertAiSection.component';

const getSelectedValueItems = (selectedValues: string[]): SelectItemType[] =>
  selectedValues.map((selectedValue) => ({
    id: selectedValue,
    label: selectedValue,
  }));

const mergeSelectItems = (items: SelectItemType[]) => uniqBy(items, 'id');

/** Persists the next selected values for a single rule argument input. */
const updateArgumentInput = (
  props: Pick<
    RuleArgumentFieldProps,
    'field' | 'index' | 'name' | 'onChange' | 'value'
  >,
  nextValues: string[]
) => {
  const { field, index, name, onChange, value } = props;
  updateAlertAiValue(
    value,
    onChange,
    getArgumentPath(field, name, index, 'input'),
    nextValues
  );
};

/** Renders a comma-separated text input for rule arguments that accept free-form values. */
const AiArgumentTextInput = ({
  argument,
  field,
  isViewOnly,
  index,
  label,
  name,
  onChange,
  placeholder,
  validationErrors,
  value: formValue,
}: AiArgumentTextInputProps) => {
  const inputValue =
    formValue.input?.[field]?.[name]?.arguments?.[index]?.input;
  const error =
    validationErrors?.[
      getValidationPath('input', field, name, 'arguments', index, 'input')
    ];

  return (
    <div className={ALERT_AI_FORM_CLASS_NAMES.field}>
      <Input
        data-testid={`${argument}-input`}
        hint={error}
        isDisabled={isViewOnly}
        isInvalid={Boolean(error)}
        label={label}
        placeholder={placeholder}
        size="sm"
        value={getCommaSeparatedValues(inputValue)}
        onChange={(nextValue) =>
          updateAlertAiValue(
            formValue,
            onChange,
            getArgumentPath(field, name, index, 'input'),
            getCommaSeparatedStringArray(nextValue)
          )
        }
      />
    </div>
  );
};

/** Renders a Core UI autocomplete for rule arguments backed by a fixed option set. */
const AiArgumentMultiSelect = ({
  argument,
  field,
  isViewOnly,
  index,
  items,
  label,
  name,
  onChange,
  placeholder,
  validationErrors,
  value,
}: AiArgumentMultiSelectProps) => {
  const inputValue = value.input?.[field]?.[name]?.arguments?.[index]?.input;
  const error =
    validationErrors?.[
      getValidationPath('input', field, name, 'arguments', index, 'input')
    ];
  const selectedValues = getListValue(inputValue);
  const selectedValueItems = selectedValues
    .map((selectedValue) => items.find((item) => item.id === selectedValue))
    .filter((item): item is SelectItemType => Boolean(item));

  return (
    <div
      className={classNames(
        ALERT_AI_FORM_CLASS_NAMES.field,
        ALERT_AI_FORM_CLASS_NAMES.autocompleteField
      )}>
      <Autocomplete
        data-testid={`${argument}-autocomplete`}
        hint={error}
        isDisabled={isViewOnly}
        isInvalid={Boolean(error)}
        items={items}
        key={selectedValues.join('|')}
        label={label}
        placeholder={placeholder}
        selectedItems={selectedValueItems}
        onItemCleared={(key) =>
          updateArgumentInput(
            { field, index, name, onChange, value },
            selectedValues.filter(
              (selectedValue) => selectedValue !== String(key)
            )
          )
        }
        onItemInserted={(key) =>
          updateArgumentInput(
            { field, index, name, onChange, value },
            selectedValues.includes(String(key))
              ? selectedValues
              : [...selectedValues, String(key)]
          )
        }>
        {(item) => (
          <Autocomplete.Item
            id={item.id}
            key={item.id}
            textValue={item.label ?? item.id}>
            {item.label ?? item.id}
          </Autocomplete.Item>
        )}
      </Autocomplete>
    </div>
  );
};

const NO_RESULTS_ID = '__no_results__';

/** Renders a searchable Core UI autocomplete for rule arguments backed by OSS search utilities. */
const AiArgumentAutocomplete = ({
  argument,
  containerEntities,
  field,
  isViewOnly,
  index,
  label,
  name,
  onChange,
  placeholder,
  selectedSource,
  validationErrors,
  value,
}: AiArgumentAutocompleteProps) => {
  const { t } = useTranslation();
  const inputValue = value.input?.[field]?.[name]?.arguments?.[index]?.input;
  const error =
    validationErrors?.[
      getValidationPath('input', field, name, 'arguments', index, 'input')
    ];
  const selectedValues = useMemo(() => getListValue(inputValue), [inputValue]);
  const containerEntitiesKey = containerEntities?.join('|') ?? '';
  const stableContainerEntities = useMemo(
    () => (containerEntitiesKey ? containerEntitiesKey.split('|') : []),
    [containerEntitiesKey]
  );
  const [items, setItems] = useState<SelectItemType[]>(() =>
    getSelectedValueItems(selectedValues)
  );
  const [hasNoResults, setHasNoResults] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    setItems((currentItems) =>
      mergeSelectItems([
        ...getSelectedValueItems(selectedValues),
        ...currentItems,
      ])
    );
  }, [selectedValues]);

  useEffect(() => {
    searchAlertAiArgumentOptions({
      argument,
      containerEntities: stableContainerEntities,
      searchText: '',
      selectedSource,
    }).then((nextItems) => {
      setItems((currentItems) =>
        mergeSelectItems([...currentItems, ...nextItems])
      );
    });
  }, [argument, selectedSource, stableContainerEntities]);

  const selectedItems = useMemo(
    () =>
      selectedValues.map(
        (selectedValue) =>
          items.find((item) => item.id === selectedValue) ?? {
            id: selectedValue,
            label: selectedValue,
          }
      ),
    [items, selectedValues]
  );

  const displayItems = useMemo(
    () =>
      hasNoResults
        ? [
            {
              id: NO_RESULTS_ID,
              isDisabled: true,
              label: t('label.no-data-found'),
            },
          ]
        : items,
    [hasNoResults, items, t]
  );

  const debouncedSearch = useMemo(
    () =>
      debounce(async (searchText: string) => {
        const nextItems = await searchAlertAiArgumentOptions({
          argument,
          containerEntities: stableContainerEntities,
          searchText,
          selectedSource,
        });

        setHasNoResults(searchText.trim() !== '' && nextItems.length === 0);
        setItems((currentItems) =>
          mergeSelectItems([...selectedItems, ...currentItems, ...nextItems])
        );
      }, 500),
    [argument, selectedItems, selectedSource, stableContainerEntities]
  );

  useEffect(
    () => () => {
      debouncedSearch.cancel();
    },
    [debouncedSearch]
  );

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen && hasNoResults && selectedValues.length === 0) {
        setHasNoResults(false);
        setResetKey((k) => k + 1);
        searchAlertAiArgumentOptions({
          argument,
          containerEntities: stableContainerEntities,
          searchText: '',
          selectedSource,
        }).then((nextItems) => {
          setItems(mergeSelectItems([...nextItems]));
        });
      }
    },
    [
      argument,
      hasNoResults,
      selectedSource,
      selectedValues.length,
      stableContainerEntities,
    ]
  );

  return (
    <div
      className={classNames(
        ALERT_AI_FORM_CLASS_NAMES.field,
        ALERT_AI_FORM_CLASS_NAMES.autocompleteField
      )}>
      <Autocomplete
        data-testid={`${argument}-autocomplete`}
        filterOption={() => true}
        hint={error}
        isDisabled={isViewOnly}
        isInvalid={Boolean(error)}
        items={displayItems}
        key={resetKey}
        label={label}
        placeholder={placeholder}
        selectedItems={selectedItems}
        onItemCleared={(key) =>
          updateArgumentInput(
            { field, index, name, onChange, value },
            selectedValues.filter(
              (selectedValue) => selectedValue !== String(key)
            )
          )
        }
        onItemInserted={(key) => {
          if (String(key) === NO_RESULTS_ID) {
            return;
          }
          updateArgumentInput(
            { field, index, name, onChange, value },
            selectedValues.includes(String(key))
              ? selectedValues
              : [...selectedValues, String(key)]
          );
        }}
        onOpenChange={handleOpenChange}
        onSearchChange={debouncedSearch}>
        {(item) => (
          <Autocomplete.Item
            id={String(item.id)}
            key={item.id}
            textValue={item.label ?? item.id}>
            {item.label ?? item.id}
          </Autocomplete.Item>
        )}
      </Autocomplete>
    </div>
  );
};

/** Chooses the correct argument input renderer based on the OSS alert rule descriptor. */
const RuleArgumentField = ({
  argument,
  containerEntities,
  field,
  isViewOnly,
  index,
  name,
  onChange,
  selectedSource,
  validationErrors,
  value,
}: RuleArgumentFieldProps & { selectedSource?: string }) => {
  const { t } = useTranslation();
  const selectConfig = getSelectArgumentConfig(argument, t);
  const textArgumentCopy = getTextArgumentCopy(argument, t);

  if (selectConfig) {
    return (
      <AiArgumentMultiSelect
        argument={argument}
        field={field}
        index={index}
        isViewOnly={isViewOnly}
        name={name}
        validationErrors={validationErrors}
        value={value}
        onChange={onChange}
        {...selectConfig}
      />
    );
  }

  if (SEARCHABLE_ARGUMENTS.has(argument)) {
    return (
      <AiArgumentAutocomplete
        argument={argument}
        containerEntities={containerEntities}
        field={field}
        index={index}
        isViewOnly={isViewOnly}
        name={name}
        selectedSource={selectedSource}
        validationErrors={validationErrors}
        value={value}
        onChange={onChange}
        {...textArgumentCopy}
      />
    );
  }

  return (
    <AiArgumentTextInput
      argument={argument}
      field={field}
      index={index}
      isViewOnly={isViewOnly}
      name={name}
      validationErrors={validationErrors}
      value={value}
      onChange={onChange}
      {...textArgumentCopy}
    />
  );
};

/** Renders filter or trigger rules for the alert form and read-only configuration view. */
const AlertAiRuleSection = ({
  containerEntities,
  field,
  isViewOnly,
  onChange,
  selectedSource,
  supportedRules,
  title,
  validationErrors,
  value,
}: RuleSectionProps) => {
  const { t } = useTranslation();
  const selectedRules = value.input?.[field] ?? [];
  const ruleCopy = getRuleCopy(field, t);

  const ruleItems = useMemo(
    () => getRuleItems(supportedRules, selectedRules),
    [selectedRules, supportedRules]
  );

  const maxRules = field === 'actions' ? 1 : supportedRules?.length ?? 0;
  const canAddRule =
    Boolean(supportedRules?.length) && selectedRules.length < maxRules;
  const isAddDisabled = isEmpty(selectedSource);
  const showAddButton =
    !isViewOnly && (field === 'filters' || selectedRules.length === 0);

  /** Updates the selected rule and rebuilds its argument placeholders. */
  const setRuleName = (index: number, key: Key | null) => {
    const ruleName = key ? String(key) : '';
    updateAlertAiValue(
      value,
      onChange,
      ['input', field],
      getRulesWithName({
        index,
        ruleName,
        selectedRules,
        supportedRules,
      })
    );
  };

  /** Updates the include/exclude effect for an existing rule. */
  const setRuleEffect = (index: number, isIncluded: boolean) => {
    updateAlertAiValue(
      value,
      onChange,
      ['input', field],
      getRulesWithEffect(selectedRules, index, isIncluded)
    );
  };

  /** Adds a new include rule placeholder. */
  const addRule = () => {
    updateAlertAiValue(
      value,
      onChange,
      ['input', field],
      getRulesWithAddedRule(selectedRules)
    );
  };

  /** Removes the selected rule while preserving the remaining rule order. */
  const removeRule = (index: number) => {
    updateAlertAiValue(
      value,
      onChange,
      ['input', field],
      getRulesWithoutIndex(selectedRules, index)
    );
  };

  if (isViewOnly && isEmpty(selectedRules)) {
    return null;
  }

  return (
    <AlertAiSection description={ruleCopy.description} title={title}>
      <Box
        className={ALERT_AI_FORM_CLASS_NAMES.sectionCard}
        direction="col"
        gap={4}>
        {selectedRules.map((_, ruleIndex) => {
          const selectedRule = selectedRules[ruleIndex];
          const selectedRuleName = selectedRule?.name ?? '';
          const ruleNameError =
            validationErrors?.[
              getValidationPath('input', field, ruleIndex, 'name')
            ];
          const runtimeArguments = getRuntimeArguments(
            selectedRule,
            supportedRules
          );

          if (isViewOnly) {
            return (
              <Box
                className={ALERT_AI_FORM_CLASS_NAMES.card}
                data-testid={`${field}-${ruleIndex}`}
                direction="col"
                gap={4}
                key={`${selectedRuleName}-${ruleIndex}`}>
                <div className={ALERT_AI_FORM_CLASS_NAMES.twoColumnGrid}>
                  <div className={ALERT_AI_FORM_CLASS_NAMES.field}>
                    <Select
                      isDisabled
                      data-testid={`${field}-select-${ruleIndex}`}
                      fontSize="sm"
                      hint={ruleNameError}
                      isInvalid={Boolean(ruleNameError)}
                      items={ruleItems}
                      label={ruleCopy.label}
                      placeholder={ruleCopy.placeholder}
                      selectedKey={selectedRuleName || null}
                      size="sm"
                      onSelectionChange={(key) => setRuleName(ruleIndex, key)}>
                      {renderSelectItem}
                    </Select>
                  </div>
                  {!isEmpty(runtimeArguments) &&
                    runtimeArguments.map((argument, index) => (
                      <div key={argument}>
                        <RuleArgumentField
                          isViewOnly
                          argument={argument}
                          containerEntities={containerEntities}
                          field={field}
                          index={index}
                          name={ruleIndex}
                          selectedSource={selectedSource}
                          validationErrors={validationErrors}
                          value={value}
                          onChange={onChange}
                        />
                      </div>
                    ))}
                </div>
                <Toggle
                  isDisabled
                  isSelected={selectedRule?.effect !== Effect.Exclude}
                  label={t('label.include')}
                  size="sm"
                  onChange={(isIncluded) =>
                    setRuleEffect(ruleIndex, isIncluded)
                  }
                />
              </Box>
            );
          }

          return (
            <Box
              className={ALERT_AI_FORM_CLASS_NAMES.card}
              data-testid={`${field}-${ruleIndex}`}
              direction="col"
              gap={4}
              key={`${selectedRuleName}-${ruleIndex}`}>
              <div className={ALERT_AI_FORM_CLASS_NAMES.ruleControlGroup}>
                <Box
                  className={ALERT_AI_FORM_CLASS_NAMES.ruleControlRow}
                  direction="row"
                  gap={3}>
                  <div className={ALERT_AI_FORM_CLASS_NAMES.fieldFill}>
                    <Select
                      data-testid={`${field}-select-${ruleIndex}`}
                      fontSize="sm"
                      hint={ruleNameError}
                      isDisabled={isViewOnly}
                      isInvalid={Boolean(ruleNameError)}
                      items={ruleItems}
                      label={ruleCopy.label}
                      placeholder={ruleCopy.placeholder}
                      selectedKey={selectedRuleName || null}
                      size="sm"
                      onSelectionChange={(key) => setRuleName(ruleIndex, key)}>
                      {renderSelectItem}
                    </Select>
                  </div>
                  {!isViewOnly && (
                    <Button
                      className={ALERT_AI_FORM_CLASS_NAMES.removeButton}
                      color="secondary"
                      data-testid={`remove-${field}-${ruleIndex}`}
                      iconLeading={Trash01}
                      size="sm"
                      onPress={() => removeRule(ruleIndex)}
                    />
                  )}
                </Box>
                {!isEmpty(runtimeArguments) && (
                  <div
                    className={classNames(
                      ALERT_AI_FORM_CLASS_NAMES.twoColumnGrid,
                      ALERT_AI_FORM_CLASS_NAMES.ruleArgumentsField,
                      'tw:mt-4'
                    )}>
                    {runtimeArguments.map((argument, index) => {
                      const isAutocomplete =
                        Boolean(getSelectArgumentConfig(argument, t)) ||
                        SEARCHABLE_ARGUMENTS.has(argument);
                      const isFullWidth =
                        isAutocomplete ||
                        (runtimeArguments.length % 2 !== 0 &&
                          index === runtimeArguments.length - 1);

                      return (
                        <div
                          className={classNames(
                            isFullWidth &&
                              ALERT_AI_FORM_CLASS_NAMES.columnSpanFull
                          )}
                          key={argument}>
                          <RuleArgumentField
                            argument={argument}
                            containerEntities={containerEntities}
                            field={field}
                            index={index}
                            isViewOnly={isViewOnly}
                            name={ruleIndex}
                            selectedSource={selectedSource}
                            validationErrors={validationErrors}
                            value={value}
                            onChange={onChange}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="tw:mt-4">
                  <Toggle
                    isDisabled={isViewOnly}
                    isSelected={selectedRule?.effect !== Effect.Exclude}
                    label={t('label.include')}
                    size="sm"
                    onChange={(isIncluded) =>
                      setRuleEffect(ruleIndex, isIncluded)
                    }
                  />
                </div>
              </div>
            </Box>
          );
        })}
        {showAddButton && (
          <Button
            className={ALERT_AI_FORM_CLASS_NAMES.actionButton}
            color="secondary"
            data-testid={`add-${field}`}
            isDisabled={isAddDisabled || !canAddRule}
            size="sm"
            onPress={addRule}>
            {t('label.add-entity', {
              entity:
                field === 'filters' ? t('label.filter') : t('label.trigger'),
            })}
          </Button>
        )}
      </Box>
    </AlertAiSection>
  );
};

export default AlertAiRuleSection;
