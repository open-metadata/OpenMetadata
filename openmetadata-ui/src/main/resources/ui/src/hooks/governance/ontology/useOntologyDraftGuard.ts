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
import { useCallback, useContext, useEffect, useId } from 'react';
import { OntologyDraftContext } from '../../../context/OntologyDraft/OntologyDraftContext';

export const useOntologyDraftGuard = () =>
  useContext(OntologyDraftContext).guard;

export const useOntologyDirtyForm = (dirty: boolean) => {
  const { setDirty } = useContext(OntologyDraftContext);
  const id = useId();
  useEffect(() => {
    setDirty(id, dirty);

    return () => setDirty(id, false);
  }, [dirty, id, setDirty]);

  return useCallback(() => setDirty(id, false), [id, setDirty]);
};
