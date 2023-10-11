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

export const getStatusTypeForApplication = (status: Status) => {
  if (status === Status.Failed) {
    return StatusType.Failure;
  } else if (status === Status.Success) {
    return StatusType.Success;
  } else if (status === Status.Running) {
    return StatusType.Warning;
  }

  return StatusType.Failure;
};
