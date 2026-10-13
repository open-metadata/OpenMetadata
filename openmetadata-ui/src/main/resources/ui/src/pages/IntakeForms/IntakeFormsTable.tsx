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
  Badge,
  Box,
  Button,
  Table,
  TableCard,
  Toggle,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import { Edit01, Trash01 } from '@openmetadata/ui-core-components/icons';
import { FC, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Loader from '../../components/common/Loader/Loader';
import { NO_DATA_PLACEHOLDER } from '../../constants/constants';
import {
  FieldKind,
  IntakeForm,
  TargetEntityType,
} from '../../generated/governance/intakeForm';
import {
  ENTITY_TYPE_LABEL_KEYS,
  getIntakeFormFields,
} from '../../utils/IntakeFormUtils';

interface IntakeFormsTableProps {
  forms: IntakeForm[];
  loading: boolean;
  onDelete: (form: IntakeForm) => void;
  onEdit: (form: IntakeForm) => void;
  onToggleEnabled: (form: IntakeForm, enabled: boolean) => void;
}

const IntakeFormsTable: FC<IntakeFormsTableProps> = ({
  forms,
  loading,
  onDelete,
  onEdit,
  onToggleEnabled,
}) => {
  const { t } = useTranslation();

  const entityTypeLabel = useCallback(
    (et: TargetEntityType) => t(ENTITY_TYPE_LABEL_KEYS[et]),
    [t]
  );

  const columns = useMemo(
    () => [
      { id: 'entityType', name: t('label.entity-type') },
      { id: 'formFields', name: t('label.field-plural') },
      { id: 'enabled', name: t('label.enabled') },
      { id: 'actions', name: t('label.action-plural') },
    ],
    [t]
  );

  return (
    <TableCard.Root size="sm">
      <Table
        aria-label={t('label.intake-form-plural')}
        data-testid="intake-forms-table">
        <Table.Header columns={columns}>
          {(col) => (
            <Table.Head
              id={col.id}
              isRowHeader={col.id === 'entityType'}
              key={col.id}
              label={col.name}
            />
          )}
        </Table.Header>
        <Table.Body
          items={forms}
          renderEmptyState={() =>
            loading ? (
              <Loader data-testid="intake-forms-loading" size="small" />
            ) : null
          }>
          {(record: IntakeForm) => (
            <Table.Row data-testid={`row-${record.entityType}`} id={record.id}>
              <Table.Cell>
                <Typography size="text-sm" weight="semibold">
                  {entityTypeLabel(record.entityType)}
                </Typography>
              </Table.Cell>
              <Table.Cell>
                <Box direction="col" gap={1}>
                  {getIntakeFormFields(record).length === 0 ? (
                    <Typography className="tw:text-tertiary" size="text-sm">
                      {NO_DATA_PLACEHOLDER}
                    </Typography>
                  ) : (
                    getIntakeFormFields(record).map((field) => (
                      <Badge
                        color={
                          field.fieldKind === FieldKind.CustomProperty
                            ? 'gray'
                            : 'brand'
                        }
                        key={field.fieldPath}
                        size="sm"
                        type="pill-color">
                        {field.fieldLabel}
                        <Typography
                          as="span"
                          className="tw:ml-1 tw:text-tertiary"
                          size="text-xs">
                          ({field.fieldPath})
                        </Typography>
                        <Typography
                          as="span"
                          className="tw:ml-1 tw:text-tertiary"
                          size="text-xs">
                          {field.required
                            ? t('label.required')
                            : t('label.optional')}
                        </Typography>
                      </Badge>
                    ))
                  )}
                </Box>
              </Table.Cell>
              <Table.Cell>
                <Toggle
                  aria-label={t('label.enabled')}
                  data-testid={`toggle-${record.entityType}`}
                  isSelected={record.enabled ?? false}
                  onChange={(enabled) => onToggleEnabled(record, enabled)}
                />
              </Table.Cell>
              <Table.Cell>
                <Box gap={2}>
                  <Tooltip title={t('label.edit')}>
                    <Button
                      color="tertiary"
                      data-testid={`edit-${record.entityType}`}
                      iconLeading={Edit01}
                      size="sm"
                      onClick={() => onEdit(record)}
                    />
                  </Tooltip>
                  <Tooltip title={t('label.delete')}>
                    <Button
                      color="tertiary-destructive"
                      data-testid={`delete-${record.entityType}`}
                      iconLeading={Trash01}
                      size="sm"
                      onClick={() => onDelete(record)}
                    />
                  </Tooltip>
                </Box>
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table>
    </TableCard.Root>
  );
};

export default IntakeFormsTable;
