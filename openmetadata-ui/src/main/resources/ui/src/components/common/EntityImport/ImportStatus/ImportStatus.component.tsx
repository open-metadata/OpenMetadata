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
import { BadgeWithIcon } from '@openmetadata/ui-core-components';
import { CheckCircle, XCircle } from '@untitledui/icons';
import { useTranslation } from 'react-i18next';
import { CSVImportResult } from '../../../../generated/type/csvImportResult';
interface ImportStatusProps {
  csvImportResult: CSVImportResult;
}

export const ImportStatus = ({ csvImportResult }: ImportStatusProps) => {
  const { t } = useTranslation();

  return (
    <div className="csv-import-status">
      <div>
        <span className="csv-import-status-label">{`${t(
          'label.number-of-rows'
        )}: `}</span>
        <span className="font-semibold" data-testid="processed-row">
          {csvImportResult.numberOfRowsProcessed}
        </span>
      </div>
      <BadgeWithIcon
        className="csv-import-status-chip csv-import-status-chip-success"
        color="success"
        iconLeading={CheckCircle}
        size="lg"
        type="pill-color">
        <span data-testid="passed-row">
          {csvImportResult.numberOfRowsPassed}
        </span>
        {` ${t('label.passed')}`}
      </BadgeWithIcon>
      <BadgeWithIcon
        className="csv-import-status-chip csv-import-status-chip-error"
        color="error"
        iconLeading={XCircle}
        size="lg"
        type="pill-color">
        <span data-testid="failed-row">
          {csvImportResult.numberOfRowsFailed}
        </span>
        {` ${t('label.failed')}`}
      </BadgeWithIcon>
    </div>
  );
};
