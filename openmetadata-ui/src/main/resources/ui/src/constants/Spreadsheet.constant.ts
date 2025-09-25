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
  Spreadsheet,
} from '../generated/entity/data/spreadsheet';

export const SPREADSHEET_DUMMY_DATA: Spreadsheet = {
  id: '492de8cb-2d1d-4dd2-982d-a16cbaff9be7',
  name: 'campaign_performance_tracker',
  fullyQualifiedName: 'sample_google_drive.campaign_performance_tracker',
  displayName: 'Campaign Performance Tracker',
  description: 'Real-time tracking of marketing campaign metrics and ROI',
  service: {
    id: '277497bc-dfa6-45a4-9a99-2bcaa8ed6dca',
    type: 'driveService',
    name: 'sample_google_drive',
    fullyQualifiedName: 'sample_google_drive',
    displayName: 'sample_google_drive',
    deleted: false,
  },
  serviceType: DriveServiceType.GoogleDrive,
  path: '/Marketing/Campaigns_2024/campaign_performance_tracker.xlsx',
  size: 3145728,
  sourceUrl:
    'https://docs.google.com/spreadsheets/d/3DxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit',
  tags: [],
  version: 0.1,
  updatedAt: 1756973450854,
  updatedBy: 'admin',
  deleted: false,
  domains: [],
  entityStatus: EntityStatus.Approved,
  followers: [],
  worksheets: [
    {
      id: '10228929-0b0d-4c76-8bd9-67621ac04eea',
      name: 'pet',
      fullyQualifiedName: 'sample_api_service.pet',
      deleted: false,
      displayName: 'Pet',
      type: 'worksheet',
    },
    {
      id: '10228929-0b0d-4c76-8bd9-67621ac04uea',
      name: 'animal',
      fullyQualifiedName: 'sample_api_service.animal',
      deleted: false,
      displayName: 'Animal',
      type: 'worksheet',
    },
  ],
};
