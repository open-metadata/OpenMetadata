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
import { useTranslation } from 'react-i18next';
import './operation-cell.less';
import {
  BulkActionOperation,
  BULK_ACTION_OPERATIONS,
  OperationBadgeProps,
  OperationSummaryProps,
} from './OperationCell.interface';

export const getOperationLabel = (
  operation: BulkActionOperation,
  t: ReturnType<typeof useTranslation>['t']
) => {
  switch (operation) {
    case 'CREATE':
      return t('label.create');
    case 'UPDATE':
      return t('label.update');
    case 'SKIP':
      return t('label.skip');
    case 'NO_CHANGE':
    default:
      return t('label.no-change');
  }
};

export const OperationBadge = ({
  currentName = '',
  operation,
  originalName = '',
}: OperationBadgeProps) => {
  const { t } = useTranslation();
  const showRenameHint =
    operation === 'CREATE' && originalName && originalName !== currentName;

  return (
    <div className="bulk-edit-operation-cell">
      <span
        className={`bulk-edit-operation-badge bulk-edit-operation-badge-${operation.toLowerCase()}`}>
        <span className="bulk-edit-operation-dot" />
        {getOperationLabel(operation, t)}
      </span>
      {showRenameHint && (
        <span className="bulk-edit-operation-rename-hint">
          <span className="bulk-edit-operation-old-name">{originalName}</span>
          <span className="bulk-edit-operation-new-name">
            {t('label.new-lowercase')}
          </span>
        </span>
      )}
    </div>
  );
};

export const OperationSummary = ({
  operations = BULK_ACTION_OPERATIONS,
  summary,
}: OperationSummaryProps) => {
  const { t } = useTranslation();

  return (
    <div
      className="bulk-edit-operation-summary"
      data-testid="bulk-edit-operation-summary">
      {operations.map((operation) => (
        <div className="bulk-edit-operation-summary-item" key={operation}>
          <span
            className={`bulk-edit-operation-summary-count bulk-edit-operation-summary-count-${operation.toLowerCase()}`}>
            {summary[operation]}
          </span>
          <span className="bulk-edit-operation-summary-label">
            {getOperationLabel(operation, t).toLowerCase()}
          </span>
        </div>
      ))}
    </div>
  );
};
