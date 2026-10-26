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
import { Box, Button } from '@openmetadata/ui-core-components';
import { XClose } from '@openmetadata/ui-core-components/icons';
import type { FieldProps } from '@react-awesome-query-builder/ui';
import classNames from 'classnames';
import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getQueryBuilderColumnRatios,
  QUERY_BUILDER_FIELD_TEST_ID,
} from './QueryBuilderCanvas.constants';
import type { QueryBuilderRuleRowProps } from './QueryBuilderCanvas.types';
import {
  configUtils,
  operatorTakesNoValue,
  resolveSelectedField,
  toFieldNodes,
} from './QueryBuilderCanvas.utils';
import QueryBuilderControl, { QueryBuilderCell } from './QueryBuilderControl';
import QueryBuilderValueCell from './QueryBuilderValueCell';

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

  const takesNoValue = operatorTakesNoValue(config, field, operator);

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
    <Box
      align="start"
      data-testid={`query-builder-rule-${ruleIndexById[String(rule.id)] ?? 0}`}
      gap={4}>
      {/* A container, so a rule in a narrow panel stacks its controls instead of squeezing them. */}
      <div className="tw:@container tw:min-w-0 tw:flex-1">
        <div
          className={classNames('tw:grid tw:gap-3.5', {
            'tw:grid-cols-1 tw:@md:grid-cols-[60fr_41fr_100fr]':
              fieldControls.length === 1,
          })}
          style={
            fieldControls.length > 1
              ? {
                  gridTemplateColumns: getQueryBuilderColumnRatios(
                    fieldControls.length
                  ),
                }
              : undefined
          }>
          {/* Each level is a grid child of its own, so a row too narrow for all
            of them wraps rather than overflowing. */}
          {fieldControls.map((control) => (
            <QueryBuilderCell
              className={classNames({
                // Narrowest a lone Field control may get before its name reads as ellipses.
                'tw:min-w-[140px]': fieldControls.length === 1,
              })}
              key={control.key}
              label={t('label.field')}>
              {config.settings.renderField?.({
                ...(control.dataTestId
                  ? { dataTestId: control.dataTestId }
                  : {}),
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
            className={classNames({
              // Narrowest the Operator control may get before a label such as "Is Not Set" reads as ellipses.
              'tw:min-w-[140px]': fieldControls.length === 1,
            })}
            items={operatorItems}
            label={t('label.operator')}
            placeholder={t('label.operator')}
            readonly={readonly || !field}
            render={config.settings.renderOperator}
            selectedKey={operator}
            onChange={(key) => actions.setOperator(path, key)}
          />

          <QueryBuilderValueCell
            cells={valueCells}
            takesNoValue={takesNoValue}
          />
        </div>
      </div>

      {canRemoveRule && !readonly && (
        // The button removes the whole rule, so it stays on the row's first line even when the row wraps; the spacer
        // stands in for the label.
        <Box className="tw:gap-1.5" direction="col">
          <span aria-hidden className="tw:invisible tw:text-sm">
            &nbsp;
          </span>
          {/* `h-10` matches the control height, so the button sits level with the row's first line. */}
          <Box align="center" className="tw:h-10">
            <Button
              aria-label={t('label.remove')}
              color={preset.delRuleColor ?? 'link-destructive'}
              data-testid={preset.testIds.delRule}
              iconLeading={XClose}
              size="sm"
              onClick={() => actions.removeRule(path)}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default QueryBuilderRuleRow;
