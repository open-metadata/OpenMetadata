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
  Button,
  Card,
  Input,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
import { Key } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ExpressionKind,
  OntologyExpression,
  RestrictionKind,
} from '../../generated/api/data/createOntologyAxiom';
import { generateUUID } from '../../utils/StringUtils';

interface OntologyExpressionEditorProps {
  depth?: number;
  expression: OntologyExpression;
  onChange: (expression: OntologyExpression) => void;
  onRemove?: () => void;
}

const MAX_EXPRESSION_DEPTH = 4;
const EXPRESSION_RENDER_KEY = Symbol('expressionRenderKey');

type RenderableOntologyExpression = OntologyExpression & {
  [EXPRESSION_RENDER_KEY]?: string;
};

export const getExpressionRenderKey = (
  expression: OntologyExpression
): string => {
  const renderableExpression = expression as RenderableOntologyExpression;
  let renderKey = renderableExpression[EXPRESSION_RENDER_KEY];

  if (!renderKey) {
    renderKey = generateUUID();
    // Keep editor identity out of callback equality checks and API JSON.
    Object.defineProperty(renderableExpression, EXPRESSION_RENDER_KEY, {
      configurable: true,
      value: renderKey,
    });
  }

  return renderKey;
};

const carryExpressionRenderKey = (
  current: OntologyExpression,
  next: OntologyExpression
): OntologyExpression => {
  Object.defineProperty(next, EXPRESSION_RENDER_KEY, {
    configurable: true,
    value: getExpressionRenderKey(current),
  });

  return next;
};

export const defaultExpression = (kind: ExpressionKind): OntologyExpression => {
  let expression: OntologyExpression;

  switch (kind) {
    case ExpressionKind.Intersection:
    case ExpressionKind.Union:
      expression = { kind, operands: [] };

      break;
    case ExpressionKind.NamedClass:
      expression = { classIri: '', kind };

      break;
    case ExpressionKind.OneOf:
      expression = { individualIris: [], kind };

      break;
    case ExpressionKind.Restriction:
      expression = {
        filler: { classIri: '', kind: ExpressionKind.NamedClass },
        kind,
        propertyIri: '',
        restrictionKind: RestrictionKind.Some,
      };

      break;
  }

  getExpressionRenderKey(expression);

  return expression;
};

const isBooleanExpression = (kind: ExpressionKind) =>
  kind === ExpressionKind.Intersection || kind === ExpressionKind.Union;

const usesCardinality = (kind: RestrictionKind) =>
  [RestrictionKind.Exact, RestrictionKind.Max, RestrictionKind.Min].includes(
    kind
  );

const nonNegative = (value: string) => Math.max(0, Number(value) || 0);

const splitValues = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

// Passed down to subcomponents that render a nested OntologyExpressionEditor,
// so they don't need to reference OntologyExpressionEditor directly (which
// would create a module-level circular reference between const declarations).
type RenderChildExpression = (props: {
  key?: string;
  depth: number;
  expression: OntologyExpression;
  onChange: (expression: OntologyExpression) => void;
  onRemove?: () => void;
}) => JSX.Element;

interface OntologyValueRestrictionFieldsProps {
  expression: OntologyExpression;
  t: (key: string) => string;
  updateExpression: (next: OntologyExpression) => void;
}

const OntologyValueRestrictionFields = ({
  expression,
  t,
  updateExpression,
}: OntologyValueRestrictionFieldsProps) => {
  return (
    <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:md:grid-cols-2">
      <Input
        label={`${t('label.target')} ${t('label.concept-iri')}`}
        value={expression.individualIri ?? ''}
        onChange={(individualIri) =>
          updateExpression({
            ...expression,
            individualIri,
            literal: individualIri ? undefined : expression.literal,
          })
        }
      />
      <Input
        label={t('label.value')}
        value={expression.literal?.value ?? ''}
        onChange={(value) =>
          updateExpression({
            ...expression,
            individualIri: value ? undefined : expression.individualIri,
            literal: value
              ? { datatypeIri: expression.literal?.datatypeIri, value }
              : undefined,
          })
        }
      />
      {expression.literal ? (
        <Input
          className="tw:md:col-span-2"
          label={`${t('label.data-type')} ${t('label.concept-iri')}`}
          value={expression.literal.datatypeIri ?? ''}
          onChange={(datatypeIri) =>
            updateExpression({
              ...expression,
              literal: {
                datatypeIri,
                value: expression.literal?.value ?? '',
              },
            })
          }
        />
      ) : null}
    </div>
  );
};

interface OntologyRestrictionFieldsProps {
  depth: number;
  expression: OntologyExpression;
  hasCardinality: boolean;
  hasNestedFiller: boolean;
  renderChildExpression: RenderChildExpression;
  restrictionKind: RestrictionKind;
  restrictionOptions: { id: RestrictionKind; label: string }[];
  t: (key: string) => string;
  updateExpression: (next: OntologyExpression) => void;
  onChangeRestriction: (key: Key | null) => void;
}

const OntologyRestrictionFields = ({
  depth,
  expression,
  hasCardinality,
  hasNestedFiller,
  renderChildExpression,
  restrictionKind,
  restrictionOptions,
  t,
  updateExpression,
  onChangeRestriction,
}: OntologyRestrictionFieldsProps) => {
  return (
    <div className="tw:flex tw:flex-col tw:gap-3">
      <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:md:grid-cols-2">
        <Input
          isRequired
          label={`${t('label.property')} ${t('label.concept-iri')}`}
          value={expression.propertyIri ?? ''}
          onChange={(propertyIri) =>
            updateExpression({ ...expression, propertyIri })
          }
        />
        <Select
          items={restrictionOptions}
          label={t('label.constraint-type')}
          value={restrictionKind}
          onChange={onChangeRestriction}>
          {(item) => (
            <Select.Item id={item.id} key={item.id} label={item.label} />
          )}
        </Select>
      </div>
      {hasCardinality ? (
        <Input
          isRequired
          label={t('label.cardinality')}
          type="number"
          value={String(expression.cardinality ?? 1)}
          onChange={(value) =>
            updateExpression({
              ...expression,
              cardinality: nonNegative(value),
            })
          }
        />
      ) : null}
      {restrictionKind === RestrictionKind.Value ? (
        <OntologyValueRestrictionFields
          expression={expression}
          t={t}
          updateExpression={updateExpression}
        />
      ) : null}
      {hasNestedFiller && expression.filler
        ? renderChildExpression({
            depth: depth + 1,
            expression: expression.filler,
            onChange: (filler) => updateExpression({ ...expression, filler }),
          })
        : null}
    </div>
  );
};

interface OntologyBooleanOperandsProps {
  addOperand: () => void;
  changeOperand: (index: number, value: OntologyExpression) => void;
  depth: number;
  operands: OntologyExpression[];
  removeOperand: (index: number) => void;
  renderChildExpression: RenderChildExpression;
  t: (key: string) => string;
}

const OntologyBooleanOperands = ({
  addOperand,
  changeOperand,
  depth,
  operands,
  removeOperand,
  renderChildExpression,
  t,
}: OntologyBooleanOperandsProps) => {
  return (
    <div className="tw:flex tw:flex-col tw:gap-3">
      <Typography className="tw:text-tertiary" size="text-xs">
        {t('label.constraint-plural')}
      </Typography>
      {operands.map((operand, index) =>
        renderChildExpression({
          depth: depth + 1,
          expression: operand,
          key: getExpressionRenderKey(operand),
          onChange: (value) => changeOperand(index, value),
          onRemove: () => removeOperand(index),
        })
      )}
      {depth < MAX_EXPRESSION_DEPTH ? (
        <Button color="secondary" size="sm" onClick={addOperand}>
          {t('label.add')} {t('label.constraint')}
        </Button>
      ) : null}
    </div>
  );
};

const OntologyExpressionEditor = ({
  depth = 0,
  expression,
  onChange: onExpressionChange,
  onRemove,
}: OntologyExpressionEditorProps) => {
  const { t } = useTranslation();
  const kindOptions = [
    { id: ExpressionKind.NamedClass, label: t('label.classification') },
    { id: ExpressionKind.Restriction, label: t('label.constraint') },
    { id: ExpressionKind.Intersection, label: t('label.and-lowercase') },
    { id: ExpressionKind.Union, label: t('label.or-lowercase') },
    { id: ExpressionKind.OneOf, label: t('label.select') },
  ];
  const restrictionOptions = [
    { id: RestrictionKind.Some, label: t('label.include') },
    { id: RestrictionKind.Only, label: t('label.only-specific-entity') },
    { id: RestrictionKind.Min, label: `${t('label.cardinality')} ≥` },
    { id: RestrictionKind.Max, label: `${t('label.cardinality')} ≤` },
    { id: RestrictionKind.Exact, label: `${t('label.cardinality')} =` },
    { id: RestrictionKind.Value, label: t('label.value') },
  ];
  const restrictionKind = expression.restrictionKind ?? RestrictionKind.Some;
  const operands = expression.operands ?? [];
  const hasNestedFiller = restrictionKind !== RestrictionKind.Value;
  const hasCardinality = [
    RestrictionKind.Exact,
    RestrictionKind.Max,
    RestrictionKind.Min,
  ].includes(restrictionKind);
  const updateExpression = (next: OntologyExpression) =>
    onExpressionChange(carryExpressionRenderKey(expression, next));

  const changeKind = (key: Key | null) => {
    if (key) {
      updateExpression(defaultExpression(String(key) as ExpressionKind));
    }
  };

  const changeRestriction = (key: Key | null) => {
    if (key) {
      const nextKind = String(key) as RestrictionKind;
      updateExpression({
        ...expression,
        cardinality: usesCardinality(nextKind)
          ? expression.cardinality ?? 1
          : undefined,
        filler:
          nextKind === RestrictionKind.Value
            ? undefined
            : expression.filler ?? defaultExpression(ExpressionKind.NamedClass),
        individualIri:
          nextKind === RestrictionKind.Value
            ? expression.individualIri
            : undefined,
        restrictionKind: nextKind,
      });
    }
  };

  const changeOperand = (index: number, value: OntologyExpression) => {
    const next = operands.map((operand, position) =>
      position === index ? value : operand
    );
    updateExpression({ ...expression, operands: next });
  };

  const removeOperand = (index: number) => {
    updateExpression({
      ...expression,
      operands: operands.filter((_, position) => position !== index),
    });
  };

  const addOperand = () => {
    updateExpression({
      ...expression,
      operands: [...operands, defaultExpression(ExpressionKind.NamedClass)],
    });
  };

  const renderChildExpression: RenderChildExpression = ({
    key,
    depth: childDepth,
    expression: childExpression,
    onChange: onChildChange,
    onRemove: onChildRemove,
  }) => (
    <OntologyExpressionEditor
      depth={childDepth}
      expression={childExpression}
      key={key}
      onChange={onChildChange}
      onRemove={onChildRemove}
    />
  );

  return (
    <Card
      className="tw:flex tw:flex-col tw:gap-3 tw:border tw:border-secondary tw:p-4"
      data-testid={`ontology-expression-${depth}`}>
      <div className="tw:flex tw:items-end tw:gap-2">
        <div className="tw:min-w-0 tw:flex-1">
          <Select
            items={kindOptions}
            label={t('label.type')}
            value={expression.kind}
            onChange={changeKind}>
            {(item) => (
              <Select.Item id={item.id} key={item.id} label={item.label} />
            )}
          </Select>
        </div>
        {onRemove ? (
          <Button color="secondary-destructive" size="sm" onClick={onRemove}>
            {t('label.remove')}
          </Button>
        ) : null}
      </div>

      {expression.kind === ExpressionKind.NamedClass ? (
        <Input
          isRequired
          label={t('label.concept-iri')}
          value={expression.classIri ?? ''}
          onChange={(classIri) => updateExpression({ ...expression, classIri })}
        />
      ) : null}

      {expression.kind === ExpressionKind.OneOf ? (
        <Input
          isRequired
          label={`${t('label.target')} ${t('label.concept-iri')}`}
          value={(expression.individualIris ?? []).join(', ')}
          onChange={(value) =>
            updateExpression({
              ...expression,
              individualIris: splitValues(value),
            })
          }
        />
      ) : null}

      {expression.kind === ExpressionKind.Restriction ? (
        <OntologyRestrictionFields
          depth={depth}
          expression={expression}
          hasCardinality={hasCardinality}
          hasNestedFiller={hasNestedFiller}
          renderChildExpression={renderChildExpression}
          restrictionKind={restrictionKind}
          restrictionOptions={restrictionOptions}
          t={t}
          updateExpression={updateExpression}
          onChangeRestriction={changeRestriction}
        />
      ) : null}

      {isBooleanExpression(expression.kind) ? (
        <OntologyBooleanOperands
          addOperand={addOperand}
          changeOperand={changeOperand}
          depth={depth}
          operands={operands}
          removeOperand={removeOperand}
          renderChildExpression={renderChildExpression}
          t={t}
        />
      ) : null}
    </Card>
  );
};

export default OntologyExpressionEditor;
