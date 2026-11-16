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

import { useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { Operation } from 'fast-json-patch';
import { isEqual } from 'lodash';
import { useCallback, useState } from 'react';
import { ClientErrors } from '../../../enums/Axios.enum';
import { TabSpecificField } from '../../../enums/entity.enum';
import {
  getGlossaryTermsById,
  patchGlossaryTerm,
} from '../../../rest/glossaryAPI';
import { PROPERTY_PATCH_MAX_RETRIES } from '../../../utils/governance/glossary/GlossaryTermProperties.constants';
import { GlossaryTermWithProperties } from '../../../utils/governance/glossary/GlossaryTermProperties.types';
import { patchGuardsDefinitions } from '../../../utils/governance/glossary/GlossaryTermProperties.utils';
import { showErrorToast } from '../../../utils/ToastUtils';

const FRESH_COPY_FIELDS = [
  TabSpecificField.PROPERTY_DEFINITIONS,
  TabSpecificField.PROPERTY_VALUES,
].join(',');

export type PropertyPatchBuilder = (
  term: GlossaryTermWithProperties
) => Operation[];

/**
 * Patches a term's property definitions and values. A definition is addressed by index and
 * guarded by a `test` on its name, so when the list moved since the page read it the server
 * answers 400; the patch is then rebuilt from a fresh copy, a bounded number of times.
 */
export const useGlossaryTermPropertyPatch = (
  term: GlossaryTermWithProperties
) => {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  const applyPatch = useCallback(
    async (buildPatch: PropertyPatchBuilder): Promise<boolean> => {
      setIsSaving(true);
      let current = term;
      try {
        for (let attempt = 0; ; attempt++) {
          const patch = buildPatch(current);
          if (patch.length === 0) {
            return true;
          }
          try {
            await patchGlossaryTerm(term.id, patch);
            // Descendants inherit from this term, so every cached term is stale.
            await queryClient.invalidateQueries({ queryKey: ['glossaryTerm'] });

            return true;
          } catch (error) {
            const isStale =
              (error as AxiosError).response?.status ===
                ClientErrors.BAD_REQUEST &&
              patchGuardsDefinitions(patch) &&
              attempt < PROPERTY_PATCH_MAX_RETRIES;
            if (!isStale) {
              throw error;
            }
            const fresh = await getGlossaryTermsById(term.id, {
              fields: FRESH_COPY_FIELDS,
            });
            // The same list means the 400 was a real validation failure, not a moved index.
            if (
              isEqual(fresh.propertyDefinitions, current.propertyDefinitions)
            ) {
              throw error;
            }
            // The server omits an empty list, so a missing field must not keep the stale one.
            current = {
              ...current,
              propertyDefinitions: fresh.propertyDefinitions,
              propertyValues: fresh.propertyValues,
            };
          }
        }
      } catch (error) {
        showErrorToast(error as AxiosError);

        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [term, queryClient]
  );

  return { applyPatch, isSaving };
};
