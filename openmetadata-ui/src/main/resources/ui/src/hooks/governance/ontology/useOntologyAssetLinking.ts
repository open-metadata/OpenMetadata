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
import { useEffect, useRef } from 'react';
import { EntityReference } from '../../../generated/type/entityReference';
import { NativeBindingBatchOutcome } from '../../../interface/governance/ontology/ontologyConceptBindings.types';
import { NATIVE_BINDING_ASSET_TYPES } from '../../../utils/governance/ontology/OntologyConceptBindings.utils';
import { useOntologyConceptBindings } from './useOntologyConceptBindings';

type Bindings = ReturnType<typeof useOntologyConceptBindings>;

/**
 * Links the picked assets one write at a time, each carrying the revision the
 * previous write returned, and stops at the first write that is not confirmed.
 * A newer batch, or a switch of concept, abandons the unsent rest of the old one.
 */
export const useOntologyAssetLinking = (
  conceptId: string,
  bindings: Bindings
) => {
  const batch = useRef<AbortController>();
  useEffect(() => () => batch.current?.abort(), [conceptId]);

  const saveAssets = async (
    selected: EntityReference[]
  ): Promise<NativeBindingBatchOutcome> => {
    const run = new AbortController();
    batch.current?.abort();
    batch.current = run;
    const completedIds: string[] = [];
    let current = bindings.editableSnapshot;
    for (const [index, asset] of selected.entries()) {
      const assetType = NATIVE_BINDING_ASSET_TYPES.find(
        (type) => type === asset.type
      );
      if (run.signal.aborted || !current || !assetType) {
        return {
          completedIds,
          remaining: selected.slice(index),
          stop: 'not-ready',
        };
      }
      if (
        current.assets.some(
          (item) => item.assetId === asset.id && item.assetType === assetType
        )
      ) {
        completedIds.push(asset.id);

        continue;
      }
      const result = await bindings.replaceAsset({
        expectedRevision: current.revision,
        asset: { assetType, assetId: asset.id, columns: [] },
      });
      if (result.kind !== 'confirmed') {
        return {
          completedIds,
          remaining: selected.slice(index),
          stop: result.kind,
        };
      }
      completedIds.push(asset.id);
      if (result.read.kind === 'unavailable') {
        return {
          completedIds,
          remaining: selected.slice(index + 1),
          stop: 'read-unavailable',
        };
      }
      current = result.read.snapshot;
    }

    return { completedIds, remaining: [], stop: 'none' };
  };

  return { saveAssets, cancel: () => batch.current?.abort() };
};
