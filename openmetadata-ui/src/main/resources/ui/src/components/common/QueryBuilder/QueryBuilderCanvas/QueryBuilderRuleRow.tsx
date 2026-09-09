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
import { Button, Typography } from '@openmetadata/ui-core-components';
import { X } from '@untitledui/icons';
import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { QUERY_BUILDER_COLUMN_RATIOS } from './QueryBuilderCanvas.constants';
import type { QueryBuilderRuleRowProps } from './QueryBuilderCanvas.types';
import {
  configUtils,
  toFieldNodes,
  toGroupFieldNodes,
} from './QueryBuilderCanvas.utils';
import QueryBuilderControl from './QueryBuilderControl';

const QueryBuilderRuleRow: FC<QueryBuilderRuleRowProps> = ({
  rule,
  path,
  context,
  groupField,
}) => {
  const { t } = useTranslation();
  const { actions, config, preset, readonly, canRemoveRule, ruleIndexById } =
    context;
  const field = rule.properties?.field ?? null;
  const operator = rule.properties?.operator ?? null;

  // A row inside a `rule_group` edits the group's field, so it offers the
  // fields a group can be built on rather than every leaf.
  const fieldItems = useMemo(
    () =>
      groupField
        ? toGroupFieldNodes(config.fields)
        : toFieldNodes(config.fields),
    [config, groupField]
  );

  const operatorItems = useMemo(() => {
    if (!field) {
      return [];
    }

    return (configUtils.getOperatorsForField(config, field) ?? []).map(
      (key) => ({
        key,
        label: String(config.operators?.[key]?.label ?? key),
        path: key,
      })
    );
  }, [config, field]);

  // Delegate the value cell to the widget the config already names for this
  // field/operator pair. Re-implementing them would drop the behaviour those
  // widgets carry: async option fetching, the date round-trip, and the rest.
  const valueCells = useMemo(() => {
    if (!field || !operator) {
      return [];
    }

    const cardinality = (
      config.operators?.[operator] as { cardinality?: number } | undefined
    )?.cardinality;
    const slots = cardinality ?? 1;
    const widgetName = configUtils.getWidgetForFieldOp(
      config,
      field,
      operator,
      'value'
    );
    const factory = widgetName
      ? (config.widgets?.[widgetName] as { factory?: FC<never> } | undefined)
          ?.factory
      : undefined;

    if (!factory || slots < 1) {
      return [];
    }

    const fieldSettings = configUtils.getFieldConfig(
      config,
      field
    )?.fieldSettings;

    return Array.from({ length: slots }, (_, delta) => ({
      id: `${field}:${operator}:${delta}`,
      node: factory({
        ...(fieldSettings ?? {}),
        config,
        field,
        operator,
        readonly,
        value: rule.properties?.value?.[delta],
        setValue: (next: unknown) =>
          actions.setValue(
            path,
            delta,
            next as never,
            (rule.properties?.valueType?.[delta] ?? 'text') as never
          ),
      } as never),
    }));
  }, [config, field, operator, rule, actions, path, readonly]);

  return (
    <div
      className="tw:flex tw:items-end tw:gap-4"
      data-testid={`query-builder-rule-${ruleIndexById[String(rule.id)] ?? 0}`}>
      <div
        className="tw:grid tw:min-w-0 tw:flex-1 tw:gap-3.5"
        style={{ gridTemplateColumns: QUERY_BUILDER_COLUMN_RATIOS }}>
        <QueryBuilderControl
          items={fieldItems}
          label={t('label.field')}
          placeholder={t('label.field')}
          readonly={readonly}
          render={config.settings.renderField}
          selectedKey={groupField?.field ?? field}
          onChange={(key) =>
            actions.setField((groupField?.path ?? path) as never, key as never)
          }
        />

        <QueryBuilderControl
          items={operatorItems}
          label={t('label.operator')}
          placeholder={t('label.operator')}
          readonly={readonly || !field}
          render={config.settings.renderOperator}
          selectedKey={operator}
          onChange={(key) => actions.setOperator(path, key)}
        />

        <div className="tw:flex tw:min-w-0 tw:flex-col tw:gap-1.5">
          <Typography
            as="span"
            className="tw:font-medium tw:text-secondary"
            size="text-sm">
            {t('label.value')}
          </Typography>
          <div
            className="tw:flex tw:min-w-0 tw:gap-2"
            data-testid="advanced-search-value">
            {valueCells.map((cell) => (
              <div className="tw:min-w-0 tw:flex-1" key={cell.id}>
                {cell.node}
              </div>
            ))}
          </div>
        </div>
      </div>

      {canRemoveRule && !readonly && (
        <Button
          aria-label={t('label.remove')}
          className="tw:mb-2.5"
          color="link-destructive"
          data-testid={preset.testIds.delRule}
          iconLeading={X}
          size="sm"
          onClick={() => actions.removeRule(path)}
        />
      )}
    </div>
  );
};

export default QueryBuilderRuleRow;
