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

export type ResourceCategory =
  | 'Discovery'
  | 'Administration'
  | 'DataGovernance'
  | 'DataQuality'
  | 'Observability';

export type ResourceType = 'Storylane' | 'Video' | 'Article';

export type ResourceDifficulty = 'Intro' | 'Intermediate' | 'Advanced';

export interface CategoryInfo {
  key: ResourceCategory;
  label: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const LEARNING_CATEGORIES: Record<ResourceCategory, CategoryInfo> = {
  Discovery: {
    key: 'Discovery',
    label: 'Discovery',
    description: 'Learn how to discover and explore data assets',
    icon: 'search',
    color: '#175cd3',
    bgColor: '#eff8ff',
    borderColor: '#b2ddff',
  },
  Administration: {
    key: 'Administration',
    label: 'Admin',
    description: 'Manage users, teams, and system configuration',
    icon: 'setting',
    color: '#026aa2',
    bgColor: '#f0f9ff',
    borderColor: '#b9e6fe',
  },
  DataGovernance: {
    key: 'DataGovernance',
    label: 'Governance',
    description: 'Implement governance policies and workflows',
    icon: 'shield',
    color: '#5925dc',
    bgColor: '#f4f3ff',
    borderColor: '#d9d6fe',
  },
  DataQuality: {
    key: 'DataQuality',
    label: 'Data Quality',
    description: 'Monitor data quality and set up tests',
    icon: 'dashboard',
    color: '#b93815',
    bgColor: '#fef6ee',
    borderColor: '#f9dbaf',
  },
  Observability: {
    key: 'Observability',
    label: 'Observability',
    description: 'Monitor system health and performance',
    icon: 'eye',
    color: '#b93815',
    bgColor: '#fef6ee',
    borderColor: '#f9dbaf',
  },
};
