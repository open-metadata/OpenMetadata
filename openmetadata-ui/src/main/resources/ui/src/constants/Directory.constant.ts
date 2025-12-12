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
  Directory,
  DriveServiceType,
} from '../generated/entity/data/directory';

export const DIRECTORY_DUMMY_DATA: Directory = {
  id: '867ee20c-b254-475c-b0ef-50195c07039a',
  name: 'Social_Media',
  fullyQualifiedName:
    'sample_google_drive.Marketing.Campaigns_2024.Social_Media',
  displayName: 'Social Media Assets',
  description: 'Images and videos for social media',
  service: {
    id: 'efe74706-6406-4b2b-b958-a899a026d7a4',
    type: 'driveService',
    name: 'sample_google_drive',
    fullyQualifiedName: 'sample_google_drive',
    displayName: 'sample_google_drive',
    deleted: false,
    href: 'http://localhost:8585/api//v1/services/driveServices/efe74706-6406-4b2b-b958-a899a026d7a4',
  },
  serviceType: DriveServiceType.GoogleDrive,
  parent: {
    id: '8107ccb0-f49f-4a29-bec8-9a912bed04af',
    type: 'directory',
    name: 'Campaigns_2024',
    fullyQualifiedName: 'sample_google_drive.Marketing.Campaigns_2024',
    description: 'All marketing campaigns for 2024',
    displayName: '2024 Marketing Campaigns',
    deleted: false,
    href: 'http://localhost:8585/api//v1/drives/directories/8107ccb0-f49f-4a29-bec8-9a912bed04af',
  },
  path: '/Marketing/Campaigns_2024/Social_Media',
  isShared: true,
  href: 'http://localhost:8585/api//v1/drives/directories/867ee20c-b254-475c-b0ef-50195c07039a',
  owners: [],
  tags: [],
  version: 0.1,
  updatedAt: 1755681440585,
  updatedBy: 'admin',
  deleted: false,
  domains: [],
  dataProducts: [],
};
