/*
 *  Copyright 2024 Collate.
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
import { EntityReference } from './Entity.interface';

export type KnowledgeCenterResponseDataType = {
  id: string;
  name: string;
  fullyQualifiedName: string;
  displayName: string;
  description: string;
  version: number;
  updatedAt: number;
  updatedBy: string;
  href: string;
  pageType: string;
  page: {
    publicationDate: number;
    relatedArticles: unknown[];
  };
  owners?: EntityReference[];
  reviewers?: EntityReference[];
  followers?: EntityReference[];
  tags?: unknown[];
  relatedEntities?: EntityReference[];
  children?: EntityReference[];
  dataProducts?: EntityReference[];
  [key: string]: unknown;
};

export type KnowledgeCenterData = {
  name: string;
  displayName: string;
  description: string;
  pageType: string;
  page: {
    publicationDate: Date;
    relatedArticles: never[];
  };
  owners?: Array<{
    type: string;
    id: string;
  }>;
  relatedEntities?: Array<{
    type: string;
    id: string;
  }>;
};
