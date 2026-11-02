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
  ButtonUtility,
  Table,
  Typography,
} from '@openmetadata/ui-core-components';
import { Edit01, Trash01 } from '@openmetadata/ui-core-components/icons';
import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { NO_PERMISSION_FOR_ACTION } from '../../../../../../constants/HelperTextUtil';
import {
  Effect,
  Rule,
} from '../../../../../../generated/api/policies/createPolicy';
import NoDataPlaceholder from '../../../../../common/EmptyPlaceholder/NoDataPlaceholder';
import RichTextEditorPreviewerV1 from '../../../../../common/RichTextEditor/RichTextEditorPreviewerV1';

type RuleColumnId =
  | 'name'
  | 'resources'
  | 'operations'
  | 'effect'
  | 'condition'
  | 'description'
  | 'actions';

interface AccessControlRulesTableProps {
  rules: Rule[];
  canEdit: boolean;
  isDisabled: boolean;
  onEdit: (rule: Rule) => void;
  onDelete: (ruleName: string) => void;
}

const formatList = (items?: string[]) => items?.join(', ') || '--';

const EffectCell = ({ effect }: { effect: Rule['effect'] }) => (
  <Typography
    className={
      effect === Effect.Allow
        ? 'tw:text-success-primary'
        : 'tw:text-error-primary'
    }
    size="text-sm"
    weight="medium">
    {effect}
  </Typography>
);

const ConditionCell = ({ condition }: { condition?: string }) =>
  condition ? (
    <code className="tw:rounded tw:bg-secondary tw:px-1 tw:text-xs tw:break-all">
      {condition}
    </code>
  ) : (
    <>--</>
  );

/** The rules of a policy, one row each; edit opens the rule's own page. */
const AccessControlRulesTable: FC<AccessControlRulesTableProps> = ({
  rules,
  canEdit,
  isDisabled,
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation();

  const columns = useMemo(
    () => [
      { id: 'name', label: t('label.name'), className: 'tw:w-60' },
      { id: 'resources', label: t('label.resource-plural') },
      { id: 'operations', label: t('label.operation-plural') },
      { id: 'effect', label: t('label.effect'), className: 'tw:w-24' },
      { id: 'condition', label: t('label.condition') },
      { id: 'description', label: t('label.description') },
      { id: 'actions', label: t('label.action-plural'), className: 'tw:w-20' },
    ],
    [t]
  );

  const actionsDisabled = !canEdit || isDisabled;
  const actionTooltip = (label: string) =>
    String(canEdit ? label : t(NO_PERMISSION_FOR_ACTION));

  const renderCell = (rule: Rule, columnId: RuleColumnId) => {
    switch (columnId) {
      case 'name':
        return (
          <Typography
            className="tw:text-primary"
            size="text-sm"
            weight="medium">
            {rule.name}
          </Typography>
        );
      case 'resources':
        return formatList(rule.resources);
      case 'operations':
        return formatList(rule.operations);
      case 'effect':
        return <EffectCell effect={rule.effect} />;
      case 'condition':
        return <ConditionCell condition={rule.condition} />;
      case 'description':
        return rule.description ? (
          <RichTextEditorPreviewerV1 markdown={rule.description} />
        ) : (
          '--'
        );
      default:
        return (
          <Box direction="row" gap={1}>
            <ButtonUtility
              color="tertiary"
              data-testid={`edit-rule-${rule.name}`}
              icon={Edit01}
              isDisabled={actionsDisabled}
              size="xs"
              tooltip={actionTooltip(t('label.edit'))}
              tooltipPlacement="left"
              onPress={() => onEdit(rule)}
            />
            <ButtonUtility
              color="tertiary"
              data-testid={`delete-rule-${rule.name}`}
              icon={Trash01}
              isDisabled={actionsDisabled}
              size="xs"
              tooltip={actionTooltip(t('label.delete'))}
              tooltipPlacement="left"
              onPress={() => onDelete(rule.name ?? '')}
            />
          </Box>
        );
    }
  };

  return (
    <Table
      aria-label={t('label.rule-plural')}
      className="tw:table-fixed"
      data-testid="rules-table"
      size="compact">
      <Table.Header columns={columns}>
        {(column) => (
          <Table.Head
            className={column.className}
            id={column.id}
            isRowHeader={column.id === 'name'}
            key={column.id}
            label={column.label}
          />
        )}
      </Table.Header>
      <Table.Body
        dependencies={[canEdit, isDisabled]}
        items={rules.map((rule) => ({ ...rule, id: rule.name ?? '' }))}
        renderEmptyState={() => (
          <NoDataPlaceholder
            title={t('label.no-entity-found', {
              entity: t('label.rule-plural'),
            })}
          />
        )}>
        {(rule) => (
          <Table.Row
            columns={columns}
            data-testid={`rule-${rule.name}`}
            id={rule.id}
            key={rule.id}>
            {(column) => (
              <Table.Cell className={column.className} key={column.id}>
                {renderCell(rule, column.id as RuleColumnId)}
              </Table.Cell>
            )}
          </Table.Row>
        )}
      </Table.Body>
    </Table>
  );
};

export default AccessControlRulesTable;
