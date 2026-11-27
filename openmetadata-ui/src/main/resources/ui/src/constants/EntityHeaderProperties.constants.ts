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

// ADR:2026-11-27-entity-header-shows-five-properties-behind-show-more
export const COLLAPSED_HEADER_PROPERTY_COUNT = 5;

export const CUSTOM_PROPERTY_HEADER_ID_PREFIX = 'extension.';

/**
 * Ids of the standard entity header properties. They are stored in a persona's
 * page as `entityHeader.properties`, so renaming one drops it from every saved
 * header that pins it (ADR:2026-11-27-persona-entity-header-stores-ordered-property-ids).
 */
export enum HeaderPropertyId {
  Domains = 'domains',
  Owners = 'owners',
  Tier = 'tier',
  Certification = 'certification',
  RetentionPeriod = 'retentionPeriod',
  Type = 'type',
  Usage = 'usage',
  Columns = 'columns',
  Rows = 'rows',
  CreatedTime = 'createdTime',
  ModifiedTime = 'modifiedTime',
  SourceUpdatedAt = 'sourceUpdatedAt',
  Partitions = 'partitions',
  ReplicationFactor = 'replicationFactor',
  Project = 'project',
  State = 'state',
  Algorithm = 'algorithm',
  Target = 'target',
  Server = 'server',
  Dashboard = 'dashboard',
  Partitioned = 'partitioned',
  NumberOfObjects = 'numberOfObjects',
  Size = 'size',
  Language = 'language',
  RequestMethod = 'requestMethod',
  Files = 'files',
  SubDirectories = 'subDirectories',
  FileExtension = 'fileExtension',
  FileVersion = 'fileVersion',
  MimeType = 'mimeType',
}

export enum HeaderPropertyFilter {
  All = 'all',
  Standard = 'standard',
  Custom = 'custom',
}
