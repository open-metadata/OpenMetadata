/*
 *  Copyright 2025 Collate.
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
  DriveServiceType,
  EntityStatus,
  Worksheet,
} from '../generated/entity/data/worksheet';

export const WORKSHEET_DUMMY_DATA: Worksheet = {
  id: '20180ea6-8a42-4b81-bfce-1c55b8b84e35',
  name: 'Sales_Pipeline',
  fullyQualifiedName: 'sample_google_drive.sales_forecast_2024.Sales_Pipeline',
  displayName: 'Sales Pipeline',
  description: 'Active sales opportunities tracking',
  spreadsheet: {
    deleted: false,
    displayName: 'Sales Forecast 2024',
    name: 'sales_forecast_2024',
    description: 'Annual sales projections and forecasting models',
    id: '413eb1cf-a141-4b39-9841-bc939182b413',
    type: 'spreadsheet',
    fullyQualifiedName: 'sample_google_drive.sales_forecast_2024',
  },
  service: {
    deleted: false,
    displayName: 'sample_google_drive',
    name: 'sample_google_drive',
    id: '277497bc-dfa6-45a4-9a99-2bcaa8ed6dca',
    type: 'driveService',
    fullyQualifiedName: 'sample_google_drive',
  },
  serviceType: DriveServiceType.GoogleDrive,
  isHidden: false,
  tags: [],
  version: 0.1,
  updatedAt: 1756973453086,
  updatedBy: 'admin',
  deleted: false,
  domains: [],
  entityStatus: EntityStatus.Approved,
  owners: [],
  followers: [],
  dataProducts: [],
};
