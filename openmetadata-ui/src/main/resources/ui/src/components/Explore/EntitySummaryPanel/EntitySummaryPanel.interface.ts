/*
 *  Copyright 2022 Collate.
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

import { ReactNode } from 'react';
import { EntityReference } from '../../../generated/entity/type';
import { PipelineViewMode } from '../../../generated/settings/settings';
import { EntityData } from '../../../pages/TasksPage/TasksPage.interface';
import { SearchedDataProps } from '../../SearchedData/SearchedData.interface';
import { EntityDetailsObjectInterface } from '../ExplorePage.interface';

export type SearchSourceDetails =
  SearchedDataProps['data'][number]['_source'] & {
    serviceType?: string;
    dataProducts?: EntityReference[];
    columnNames?: string[];
    database?: EntityReference;
    databaseSchema?: EntityReference;
    tableType?: string;
  };

export interface EntitySummaryPanelProps {
  readonly entityDetails: EntityDetailsObjectInterface;
  readonly handleClosePanel: () => void;
  readonly highlights?: SearchedDataProps['data'][number]['highlight'];
  readonly panelPath?: string;
  readonly isSideDrawer?: boolean;
  readonly upstreamDepth?: number;
  readonly pipelineViewMode?: PipelineViewMode;
  readonly downstreamDepth?: number;
  readonly nodesPerLayer?: number;
  readonly onEntityUpdate?: (updatedEntity: Partial<EntityData>) => void;
  readonly ontologyExplorerRelationsSlot?: ReactNode;
  readonly sideDrawerOverviewOnly?: boolean;
}
