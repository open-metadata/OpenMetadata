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
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AssetBinding,
  State,
} from '../../../generated/type/ontologyConceptBindingsResponse';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getOntologyBindingWriteMessage } from '../../../utils/governance/ontology/OntologyConceptBindings.utils';
import { showUndoToast } from '../../../utils/governance/ontology/OntologyUndoToast';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { useOntologyConceptBindings } from './useOntologyConceptBindings';

type Bindings = ReturnType<typeof useOntologyConceptBindings>;

/**
 * Removes an asset binding and offers Undo, which writes the asset back with the
 * columns that were bound. Unresolved columns point at nothing the server can
 * validate, so they are not restored.
 */
export const useOntologyAssetUnlink = (
  bindings: Bindings,
  conceptName: string
) => {
  const { t } = useTranslation();
  const latest = useRef(bindings);
  latest.current = bindings;

  const restore = async (binding: AssetBinding) => {
    const snapshot = latest.current.editableSnapshot;
    if (!snapshot) {
      showErrorToast(t('message.ontology-binding-not-ready'));

      return;
    }
    const result = await latest.current.replaceAsset({
      expectedRevision: snapshot.revision,
      asset: {
        assetId: binding.assetId,
        assetType: binding.assetType,
        columns: binding.columns
          .filter((column) => column.state === State.Resolved)
          .map(({ columnPath, propertyId }) => ({ columnPath, propertyId })),
      },
    });
    const notify =
      result.kind === 'confirmed' ? showSuccessToast : showErrorToast;
    notify(t(getOntologyBindingWriteMessage(result)));
  };

  return async (binding: AssetBinding): Promise<boolean> => {
    const snapshot = latest.current.editableSnapshot;
    if (!snapshot) {
      return false;
    }
    const result = await latest.current.removeAsset({
      assetId: binding.assetId,
      assetType: binding.assetType,
      expectedRevision: snapshot.revision,
    });
    if (result.kind === 'confirmed' && result.read.kind === 'ready') {
      showUndoToast(
        t('message.ontology-asset-unlinked', {
          asset: getEntityName(binding.asset),
          concept: conceptName,
        }),
        () => restore(binding)
      );
    } else {
      const notify =
        result.kind === 'confirmed' ? showSuccessToast : showErrorToast;
      notify(t(getOntologyBindingWriteMessage(result)));
    }

    return result.kind === 'confirmed';
  };
};
