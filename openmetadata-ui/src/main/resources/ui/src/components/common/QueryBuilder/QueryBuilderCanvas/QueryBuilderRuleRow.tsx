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
import { Button, Select } from '@openmetadata/ui-core-components';
import type { FieldProps } from '@react-awesome-query-builder/ui';
import { X } from '@untitledui/icons';
import classNames from 'classnames';
import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getQueryBuilderColumnRatios,
  QUERY_BUILDER_CONTROL_HEIGHT,
  QUERY_BUILDER_FIELD_MIN_WIDTH,
  QUERY_BUILDER_FIELD_TEST_ID,
  QUERY_BUILDER_VALUE_MIN_WIDTH,
} from './QueryBuilderCanvas.constants';
import type { QueryBuilderRuleRowProps } from './QueryBuilderCanvas.types';
import {
  configUtils,
  resolveSelectedField,
  toFieldNodes,
} from './QueryBuilderCanvas.utils';
import QueryBuilderControl, { QueryBuilderCell } from './QueryBuilderControl';

const QueryBuilderRuleRow: FC<QueryBuilderRuleRowProps> = ({
  rule,
  path,
  context,
  cells,
}) => {
  const { t } = useTranslation();
  const { actions, config, preset, readonly, canRemoveRule, ruleIndexById } =
    context;
  const field = rule.properties?.field ?? null;
  const operator = rule.properties?.operator ?? null;

  // One control per level the user has drilled through, each choosing within the level above it.
  const fieldControls = useMemo(
    () =>
      cells.map((cell, index) => ({
        dataTestId:
          index === 0 ? undefined : `${QUERY_BUILDER_FIELD_TEST_ID}-${index}`,
        items: toFieldNodes(cell.fields ?? config.fields, cell.prefix),
        key: cell.path.join('.'),
        path: cell.path,
        selectedKey: cell.field,
      })),
    [cells, config]
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

  // Delegate the value cell to the widget the config already names for this field/operator pair.
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
    const widgetDef = widgetName
      ? (config.widgets?.[widgetName] as
          | { factory?: FC<never>; type?: string }
          | undefined)
      : undefined;
    const factory = widgetDef?.factory;

    if (!factory || slots < 1) {
      return [];
    }

    const fieldConfig = configUtils.getFieldConfig(config, field);
    // What kind of value RAQB is storing.
    const valueType =
      widgetDef?.type ?? (fieldConfig?.type as string | undefined) ?? 'text';

    return Array.from({ length: slots }, (_, delta) => ({
      id: `${field}:${operator}:${delta}`,
      node: factory({
        ...(fieldConfig?.fieldSettings ?? {}),
        config,
        // Which value slot this widget owns.
        delta,
        field,
        operator,
        readonly,
        value: rule.properties?.value?.[delta],
        setValue: (next: unknown) =>
          actions.setValue(
            path,
            delta,
            next as never,
            (rule.properties?.valueType?.[delta] ?? valueType) as never
          ),
      } as never),
    }));
  }, [config, field, operator, rule, actions, path, readonly]);

  return (
    <div
      className="tw:flex tw:items-start tw:gap-4"
      data-testid={`query-builder-rule-${ruleIndexById[String(rule.id)] ?? 0}`}>
      <div
        className="tw:grid tw:min-w-0 tw:flex-1 tw:gap-3.5"
        style={{
          gridTemplateColumns: getQueryBuilderColumnRatios(
            fieldControls.length
          ),
        }}>
        {/* Each level is a grid child of its own, so a row too narrow for all
            of them wraps rather than overflowing. */}
        {fieldControls.map((control) => (
          <QueryBuilderCell
            className={classNames({
              [QUERY_BUILDER_FIELD_MIN_WIDTH]: fieldControls.length === 1,
            })}
            key={control.key}
            label={t('label.field')}>
            {config.settings.renderField?.({
              ...(control.dataTestId ? { dataTestId: control.dataTestId } : {}),
              items: control.items,
              placeholder: t('label.field'),
              readonly,
              selectedKey: control.selectedKey ?? undefined,
              setField: (key: string) =>
                actions.setField(
                  control.path as never,
                  resolveSelectedField(config, key) as never
                ),
            } as unknown as FieldProps)}
          </QueryBuilderCell>
        ))}

        <QueryBuilderControl
          items={operatorItems}
          label={t('label.operator')}
          placeholder={t('label.operator')}
          readonly={readonly || !field}
          render={config.settings.renderOperator}
          selectedKey={operator}
          onChange={(key) => actions.setOperator(path, key)}
        />

        <QueryBuilderCell label={t('label.value')}>
          <div
            className="tw:flex tw:min-w-0 tw:flex-wrap tw:gap-2"
            data-testid="advanced-search-value">
            {/* Until the field and operator name a widget there is nothing to
                edit, but the column still reads as part of the row — an empty
                gap where a control belongs looks like a rendering fault. */}
            {valueCells.length === 0 ? (
              <Select
                isDisabled
                aria-label={t('label.value')}
                className="tw:min-w-0 tw:flex-1"
                items={[]}
                placeholder={t('label.value')}
                size="sm">
                {(item) => (
                  <Select.Item id={String(item.id)} key={String(item.id)}>
                    {String(item.id)}
                  </Select.Item>
                )}
              </Select>
            ) : (
              valueCells.map((cell) => (
                // A two-valued operator keeps both slots readable: they share the column when it is wide enough and
                // wrap when it is not.
                <div
                  className={classNames(
                    'tw:flex-1',
                    QUERY_BUILDER_VALUE_MIN_WIDTH
                  )}
                  key={cell.id}>
                  {cell.node}
                </div>
              ))
            )}
          </div>
        </QueryBuilderCell>
      </div>

      {canRemoveRule && !readonly && (
        // The button removes the whole rule, so it stays on the row's first line even when the row wraps; the spacer
        // stands in for the label.
        <div className="tw:flex tw:flex-col tw:gap-1.5">
          <span aria-hidden className="tw:invisible tw:text-sm">
            &nbsp;
          </span>
          <div
            className={classNames(
              'tw:flex tw:items-center',
              QUERY_BUILDER_CONTROL_HEIGHT
            )}>
            <Button
              aria-label={t('label.remove')}
              color="link-destructive"
              data-testid={preset.testIds.delRule}
              iconLeading={X}
              size="sm"
              onClick={() => actions.removeRule(path)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default QueryBuilderRuleRow;
