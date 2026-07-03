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

import { Table, TableCard } from '@openmetadata/ui-core-components';
import { Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import NextPrevious from '../../../components/common/NextPrevious/NextPrevious';
import RichTextEditorPreviewerNew from '../../../components/common/RichTextEditor/RichTextEditorPreviewNew';
import { ALERTS_DOCS } from '../../../constants/docs.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { EventSubscription } from '../../../generated/events/eventSubscription';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { ALERT_TABLE_COLUMN_IDS } from '../ObservabilityAlertsPage.constants';
import { ObservabilityAlertsTableProps } from '../ObservabilityAlertsPage.interface';
import {
  getAlertTableCellLayoutClassName,
  getAlertTableHeaderLayoutClassName,
} from '../ObservabilityAlertsPage.utils';
import ObservabilityAlertActions from './ObservabilityAlertActions';

function ObservabilityAlertsTable({
  alertPermissions,
  alerts,
  columnList,
  currentPage,
  getAlertDetailsPath,
  loading,
  loadingCount,
  onAddAlert,
  onPageChange,
  onPageSizeChange,
  onSelectAlert,
  onViewAlert,
  paging,
  pageSize,
  showPagination,
}: Readonly<ObservabilityAlertsTableProps>) {
  const { t } = useTranslation();

  const renderRow = (record: EventSubscription) => {
    const alertPermission = alertPermissions?.find(
      (alert) => alert.id === record.id
    );
    const alertName = getEntityName(record);
    const alertFqn = record.fullyQualifiedName ?? '';

    return (
      <Table.Row data-row-key={record.id} id={record.id} key={record.id}>
        <Table.Cell
          className={getAlertTableCellLayoutClassName(
            ALERT_TABLE_COLUMN_IDS.NAME
          )}>
          {onViewAlert ? (
            <Button
              className="tw:h-auto tw:p-0"
              data-testid="alert-name"
              type="link"
              onClick={() => onViewAlert(record)}>
              {alertName}
            </Button>
          ) : (
            <Link data-testid="alert-name" to={getAlertDetailsPath(alertFqn)}>
              {alertName}
            </Link>
          )}
        </Table.Cell>
        <Table.Cell
          className={getAlertTableCellLayoutClassName(
            ALERT_TABLE_COLUMN_IDS.TRIGGER
          )}>
          {record.filteringRules?.resources?.join(', ') || '--'}
        </Table.Cell>
        <Table.Cell
          className={getAlertTableCellLayoutClassName(
            ALERT_TABLE_COLUMN_IDS.DESCRIPTION
          )}>
          <RichTextEditorPreviewerNew markdown={record.description ?? ''} />
        </Table.Cell>
        <Table.Cell
          className={getAlertTableCellLayoutClassName(
            ALERT_TABLE_COLUMN_IDS.ACTIONS
          )}>
          <div className="tw:flex tw:h-full tw:items-start">
            <ObservabilityAlertActions
              alertPermission={alertPermission}
              loading={loadingCount > 0}
              record={record}
              onSelectAlert={onSelectAlert}
            />
          </div>
        </Table.Cell>
      </Table.Row>
    );
  };

  return (
    <TableCard.Root>
      <div className="tw:border-b tw:border-secondary">
        <Table
          aria-label={t('label.observability-alert')}
          data-testid="alert-table">
          <Table.Header columns={columnList}>
            {(col) => (
              <Table.Head
                className={getAlertTableHeaderLayoutClassName(col.id)}
                id={col.id}
                key={col.id}
                label={col.name}
              />
            )}
          </Table.Header>
          <Table.Body
            dependencies={[loadingCount, alertPermissions]}
            items={loading ? [] : alerts}
            renderEmptyState={() =>
              loading ? (
                <></>
              ) : (
                <ErrorPlaceHolder
                  permission
                  className="p-y-md border-none"
                  doc={ALERTS_DOCS}
                  heading={t('label.alert')}
                  permissionValue={t('label.create-entity', {
                    entity: t('label.alert'),
                  })}
                  type={ERROR_PLACEHOLDER_TYPE.CREATE}
                  onClick={onAddAlert}
                />
              )
            }>
            {(record) => renderRow(record as EventSubscription)}
          </Table.Body>
        </Table>
      </div>
      {showPagination && (
        <div className="tw:py-3">
          <NextPrevious
            currentPage={currentPage}
            isLoading={loading}
            pageSize={pageSize}
            paging={paging}
            pagingHandler={onPageChange}
            onShowSizeChange={onPageSizeChange}
          />
        </div>
      )}
    </TableCard.Root>
  );
}

export default ObservabilityAlertsTable;
