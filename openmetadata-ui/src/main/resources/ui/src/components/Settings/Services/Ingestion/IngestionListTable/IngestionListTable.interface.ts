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
import { ServiceCategory } from '../../../../../enums/service.enum';
import { PipelineType } from '../../../../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import { IngestionPipeline } from '../../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { Paging } from '../../../../../generated/type/paging';
import { UsePagingInterface } from '../../../../../hooks/paging/usePaging';
import { UseAirflowStatusProps } from '../../../../../hooks/useAirflowStatus';
import { PagingHandlerParams } from '../../../../common/NextPrevious/NextPrevious.interface';

export interface IngestionListTableProps {
  enableActions?: boolean;
  isNumberBasedPaging?: boolean;
  ingestionPagingInfo?: UsePagingInterface;
  ingestionData: Array<IngestionPipeline>;
  isLoading?: boolean;
  pipelineIdToFetchStatus?: string;
  pipelineType?: PipelineType;
  airflowInformation?: UseAirflowStatusProps;
  serviceCategory?: ServiceCategory;
  emptyPlaceholder?: ReactNode;
  serviceName?: string;
  deployIngestion?: (id: string, displayName: string) => Promise<void>;
  handleIngestionListUpdate?: (
    ingestionList: React.SetStateAction<IngestionPipeline[]>
  ) => void;
  handleEnableDisableIngestion?: (id: string) => Promise<void>;
  onIngestionWorkflowsUpdate?: (
    paging?: Omit<Paging, 'total'>,
    limit?: number
  ) => void;
  triggerIngestion?: (id: string, displayName: string) => Promise<void>;
  handlePipelineIdToFetchStatus?: (pipelineId?: string) => void;
  onPageChange?: ({ cursorType, currentPage }: PagingHandlerParams) => void;
  extraTableProps?: TableProps<IngestionPipeline>;
  pipelineTypeColumnObj?: ColumnsType<IngestionPipeline>;
}
