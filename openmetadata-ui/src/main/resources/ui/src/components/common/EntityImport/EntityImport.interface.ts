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
import React from 'react';
import { CSVImportResult } from '../../../generated/type/csvImportResult';
import { CSVImportAsyncResponse } from '../../../pages/EntityImport/BulkEntityImportPage/BulkEntityImportPage.interface';

export interface EntityImportProps {
  entityName: string;
  onImport: (
    name: string,
    data: string,
    dryRun?: boolean
  ) => Promise<CSVImportAsyncResponse | undefined>;
  onSuccess: () => void;
  onCancel: () => void;
  onCsvResultUpdate?: (result: CSVImportResult) => void;
  children: React.ReactNode;
}
