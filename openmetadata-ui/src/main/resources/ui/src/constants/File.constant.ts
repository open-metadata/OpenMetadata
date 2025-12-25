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
  File,
  FileType,
} from '../generated/entity/data/file';

export const FILE_DUMMY_DATA: File = {
  id: '6e5d3382-c46c-43b3-82d2-0b927b9b9946',
  name: 'marketing_strategy_2024.pdf',
  fullyQualifiedName:
    'sample_google_drive.Marketing."marketing_strategy_2024.pdf"',
  displayName: 'Marketing Strategy 2024',
  description: 'Comprehensive marketing strategy document for 2024',
  service: {
    id: '277497bc-dfa6-45a4-9a99-2bcaa8ed6dca',
    type: 'driveService',
    name: 'sample_google_drive',
    fullyQualifiedName: 'sample_google_drive',
    displayName: 'sample_google_drive',
    deleted: false,
  },
  serviceType: DriveServiceType.GoogleDrive,
  directory: {
    id: 'bd0b81e6-3a91-4774-8d28-22bed75d94af',
    type: 'directory',
    name: 'Marketing',
    fullyQualifiedName: 'sample_google_drive.Marketing',
    description: 'Marketing materials and campaigns',
    displayName: 'Marketing Department',
    deleted: false,
  },
  fileType: FileType.PDF,
  mimeType: 'application/pdf',
  fileExtension: 'pdf',
  path: '/Marketing/marketing_strategy_2024.pdf',
  size: 5242880,
  checksum: '098f6bcd4621d373cade4e832627b4f6',
  webViewLink:
    'https://drive.google.com/file/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/view',
  downloadLink:
    'https://drive.google.com/uc?export=download&id=1aBcDeFgHiJkLmNoPqRsTuVwXyZ',
  isShared: true,
  fileVersion: '15',
  sourceUrl: 'https://drive.google.com/file/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/view',
  tags: [],
  version: 0.1,
  updatedAt: 1756973448457,
  updatedBy: 'admin',
  deleted: false,
  domains: [],
  entityStatus: EntityStatus.Approved,
  owners: [],
  followers: [],
  createdTime: 0,
  modifiedTime: 0,
};
