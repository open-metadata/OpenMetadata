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
import { OntologyPublicationStatus } from '../../../generated/type/ontologyPublicationStatus';

/**
 * The changes a user made since the active release. Before the first release the server
 * counts the ontology itself as an added member; the user did not make that a change.
 */
export const getUnpublishedCount = (
  status: OntologyPublicationStatus | undefined
) => {
  const count = status?.unpublishedChanges ?? 0;

  return status?.active ? count : Math.max(count - 1, 0);
};
