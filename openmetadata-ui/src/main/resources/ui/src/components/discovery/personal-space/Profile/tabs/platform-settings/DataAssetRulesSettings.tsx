/*
 *  Copyright 2023 Collate.
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
  EmptyPlaceholder,
  Table,
  TableCard,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import { FileCheck02 } from '@openmetadata/ui-core-components/icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SemanticsRule } from '../../../../../../generated/settings/settings';
import RichTextEditorPreviewerNew from '../../../../../common/RichTextEditor/RichTextEditorPreviewNew';
import { useSemanticsRulesState } from '../../../../../DataAssetRules/DataAssetRules.component';
import { SettingsSkeleton } from './SettingsFormLayout';

/** Rules are toggled on and off in place; adding rules is not supported yet. */
const DataAssetRulesSettings = () => {
  const { t } = useTranslation();
  const { semanticsRules, isLoading, isSaveLoading, updateSemanticsRules } =
    useSemanticsRulesState();

  const columns = useMemo(
    () => [
      { id: 'name', label: t('label.name'), className: 'tw:w-60' },
      { id: 'description', label: t('label.description') },
      { id: 'enabled', label: t('label.enabled'), className: 'tw:w-28' },
    ],
    [t]
  );

  const toggleRule = (rule: SemanticsRule) =>
    updateSemanticsRules(
      semanticsRules.map((item) =>
        item.name === rule.name ? { ...item, enabled: !item.enabled } : item
      )
    ).catch(() => undefined);

  const renderCell = (rule: SemanticsRule, columnId: string) => {
    if (columnId === 'name') {
      return (
        <Typography size="text-sm" weight="medium">
          {rule.name}
        </Typography>
      );
    }

    if (columnId === 'description') {
      return <RichTextEditorPreviewerNew markdown={rule.description ?? ''} />;
    }

    return (
      <Toggle
        aria-label={t('label.enabled')}
        data-testid={`toggle-${rule.name}`}
        isDisabled={isSaveLoading}
        isSelected={Boolean(rule.enabled)}
        size="sm"
        onChange={() => toggleRule(rule)}
      />
    );
  };

  if (isLoading) {
    return <SettingsSkeleton rows={5} />;
  }

  if (semanticsRules.length === 0) {
    return (
      // The placeholder centres itself in its nearest positioned ancestor.
      <div className="tw:relative tw:min-h-90">
        <EmptyPlaceholder
          data-testid="data-asset-rules-empty"
          icon={<FileCheck02 className="tw:text-quaternary" />}
          title={t('label.no-entity', { entity: t('label.data-asset-rules') })}
        />
      </div>
    );
  }

  return (
    <Box data-testid="data-asset-rules-settings" direction="col">
      <TableCard.Root size="compact">
        <Table
          aria-label={t('label.data-asset-rules')}
          data-testid="data-asset-rules-table"
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
          <Table.Body items={semanticsRules}>
            {(rule) => (
              <Table.Row
                columns={columns}
                data-testid={`data-asset-rule-${rule.name}`}
                id={rule.name}
                key={rule.name}>
                {(column) => (
                  <Table.Cell className={column.className} key={column.id}>
                    {renderCell(rule, column.id)}
                  </Table.Cell>
                )}
              </Table.Row>
            )}
          </Table.Body>
        </Table>
      </TableCard.Root>
    </Box>
  );
};

export default DataAssetRulesSettings;
