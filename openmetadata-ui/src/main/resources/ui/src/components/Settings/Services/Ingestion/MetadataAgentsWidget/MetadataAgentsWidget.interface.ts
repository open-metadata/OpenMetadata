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
import { AirflowStatusContextType } from '../../../../../context/AirflowStatusProvider/AirflowStatusProvider.interface';
import {
  IngestionPipeline,
  PipelineType,
} from '../../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { Paging } from '../../../../../generated/type/paging';
import { UsePagingInterface } from '../../../../../hooks/paging/usePaging';
import { ServicesType } from '../../../../../interface/service.interface';
import { PagingHandlerParams } from '../../../../common/NextPrevious/NextPrevious.interface';

export interface MetadataAgentsWidgetProps {
  ingestionPagingInfo: UsePagingInterface;
  serviceDetails: ServicesType;
  serviceName: string;
  ingestionPipelineList: Array<IngestionPipeline>;
  pipelineType?: PipelineType;
  isLoading?: boolean;
  searchText: string;
  airflowInformation: AirflowStatusContextType;
  onIngestionWorkflowsUpdate: (
    paging?: Omit<Paging, 'total'>,
    limit?: number
  ) => void;
  handleIngestionListUpdate: (
    ingestionList: React.SetStateAction<IngestionPipeline[]>
  ) => void;
  onPageChange: ({ cursorType, currentPage }: PagingHandlerParams) => void;
}
