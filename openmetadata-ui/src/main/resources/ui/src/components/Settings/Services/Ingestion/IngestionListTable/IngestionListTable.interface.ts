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

import { TableProps } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { ReactNode } from 'react';
import { AirflowStatusContextType } from '../../../../../context/AirflowStatusProvider/AirflowStatusProvider.interface';
import { ServiceCategory } from '../../../../../enums/service.enum';
import { PipelineType } from '../../../../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import {
  IngestionPipeline,
  StepSummary,
} from '../../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { Paging } from '../../../../../generated/type/paging';
import { UsePagingInterface } from '../../../../../hooks/paging/usePaging';
import { PagingHandlerParams } from '../../../../common/NextPrevious/NextPrevious.interface';

export interface IngestionListTableProps {
  tableContainerClassName?: string;
  afterDeleteAction?: () => void;
  airflowInformation?: AirflowStatusContextType;
  deployIngestion?: (id: string, displayName: string) => Promise<void>;
  emptyPlaceholder?: ReactNode;
  enableActions?: boolean;
  extraTableProps?: TableProps<IngestionPipeline>;
  handleEditClick?: (fqn: string) => void;
  handleEnableDisableIngestion?: (id: string) => Promise<void>;
  handleIngestionListUpdate?: (
    ingestionList: React.SetStateAction<IngestionPipeline[]>
  ) => void;
  handlePipelineIdToFetchStatus?: (pipelineId?: string) => void;
  ingestionData: Array<IngestionPipeline>;
  ingestionPagingInfo?: UsePagingInterface;
  isLoading?: boolean;
  isNumberBasedPaging?: boolean;
  onIngestionWorkflowsUpdate?: (
    paging?: Omit<Paging, 'total'>,
    limit?: number
  ) => void;
  onPageChange?: ({ cursorType, currentPage }: PagingHandlerParams) => void;
  pipelineIdToFetchStatus?: string;
  pipelineType?: PipelineType;
  pipelineTypeColumnObj?: ColumnsType<IngestionPipeline>;
  serviceCategory?: ServiceCategory;
  serviceName?: string;
  showDescriptionCol?: boolean;
  triggerIngestion?: (id: string, displayName: string) => Promise<void>;
  customRenderNameField?: (
    text: string,
    record: IngestionPipeline
  ) => ReactNode;
  tableClassName?: string;
  searchText?: string;
}

export interface ModifiedIngestionPipeline extends IngestionPipeline {
  runStatus?: StepSummary;
  runId?: string;
}
