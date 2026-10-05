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
import { AxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { MutationOp } from '../../../generated/governance/changeRequest/changeRequest';
import { getChangeRequest } from '../../../rest/changeRequestsAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import ChangeRequestChanges from './ChangeRequestChanges.component';

/** The changes a review task's change request proposes, at its active revision. */
const ChangeRequestChangesById = ({
  changeRequestId,
}: {
  changeRequestId: string;
}) => {
  const [ops, setOps] = useState<MutationOp[]>();

  useEffect(() => {
    getChangeRequest(changeRequestId)
      .then((request) => setOps(request.activeRevision?.ops ?? []))
      .catch((error: AxiosError) => showErrorToast(error));
  }, [changeRequestId]);

  return ops ? <ChangeRequestChanges ops={ops} /> : null;
};

export default ChangeRequestChangesById;
