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
import { StatusType } from '../components/common/StatusBadge/StatusBadge.interface';
import { Status } from '../generated/entity/applications/appRunRecord';
import { PipelineState } from '../generated/entity/services/ingestionPipelines/ingestionPipeline';

export const getStatusTypeForApplication = (status: Status) => {
  switch (status) {
    case Status.Failed:
      return StatusType.Failure;

    case Status.Success:
    case Status.Completed:
      return StatusType.Success;

    case Status.Running:
      return StatusType.Warning;

    default:
      return StatusType.Failure;
  }
};

export const getStatusFromPipelineState = (status: PipelineState) => {
  if (status === PipelineState.Failed) {
    return Status.Failed;
  } else if (status === PipelineState.Success) {
    return Status.Success;
  } else if (
    status === PipelineState.Running ||
    status === PipelineState.PartialSuccess ||
    status === PipelineState.Queued
  ) {
    return Status.Running;
  }

  return Status.Failed;
};
