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
import {
  Box,
  Button,
  ButtonUtility,
  Typography,
} from '@openmetadata/ui-core-components';
import { Link01, Plus, Trash01 } from '@openmetadata/ui-core-components/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AssetType } from '../../../../generated/api/data/updateOntologyConceptBinding';
import { useOntologyConceptBindings } from '../../../../hooks/governance/ontology/useOntologyConceptBindings';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { getOntologyBindingWriteMessage } from '../../../../utils/governance/ontology/OntologyConceptBindings.utils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import OntologyColumnBindingEditor from './OntologyColumnBindingEditor';

interface OntologyPropertyBindingsProps {
  conceptId: string;
  propertyId: string;
  canEdit: boolean;
  canAdd?: boolean;
  bindings: ReturnType<typeof useOntologyConceptBindings>;
}

const OntologyPropertyBindings = ({
  conceptId,
  propertyId,
  canEdit,
  canAdd = true,
  bindings,
}: OntologyPropertyBindingsProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const columns =
    bindings.data?.assets.flatMap((asset) =>
      asset.columns
        .filter((column) => column.propertyId === propertyId)
        .map((column) => ({ asset, column }))
    ) ?? [];

  const renderEditor = () => {
    if (!canAdd || !canEdit) {
      return null;
    }

    return isOpen ? (
      <OntologyColumnBindingEditor
        conceptId={conceptId}
        key={`${conceptId}:${propertyId}`}
        propertyId={propertyId}
        onClose={() => setIsOpen(false)}
      />
    ) : (
      <Button
        color="link-color"
        data-testid={`ontology-bind-property-${propertyId}`}
        iconLeading={Plus}
        isDisabled={!bindings.editableSnapshot}
        size="xs"
        onPress={() => setIsOpen(true)}>
        {t('label.ontology-bind-to-column')}
      </Button>
    );
  };

  return (
    <Box
      data-testid={`ontology-property-bindings-${propertyId}`}
      direction="col"
      gap={1}>
      {columns.map(({ asset, column }) => (
        <Box
          align="center"
          gap={1}
          key={`${asset.assetId}:${JSON.stringify(column.columnPath)}`}>
          <Link01
            aria-hidden
            className="tw:size-3 tw:shrink-0 tw:text-fg-success-secondary"
          />
          <Typography
            ellipsis
            color={column.state === 'resolved' ? 'secondary' : 'warning'}
            size="text-xs">
            {getEntityName(asset.asset)} · {column.columnPath.join(' › ')}
            {column.state === 'unresolved'
              ? ` · ${t('label.unavailable')}`
              : ''}
          </Typography>
          {canEdit ? (
            <ButtonUtility
              color="tertiary"
              data-testid={`ontology-binding-remove-${propertyId}`}
              icon={Trash01}
              isDisabled={!bindings.editableSnapshot}
              size="xs"
              tooltip={t('label.remove-entity', {
                entity: column.columnPath.join(' › '),
              })}
              onClick={async () => {
                if (bindings.editableSnapshot) {
                  const result = await bindings.replaceAsset({
                    expectedRevision: bindings.editableSnapshot.revision,
                    asset: {
                      assetId: asset.assetId,
                      assetType: AssetType.Table,
                      columns: asset.columns
                        .filter((item) => item !== column)
                        .map(({ propertyId, columnPath }) => ({
                          propertyId,
                          columnPath,
                        })),
                    },
                  });
                  const notify =
                    result.kind === 'confirmed'
                      ? showSuccessToast
                      : showErrorToast;
                  notify(t(getOntologyBindingWriteMessage(result)));
                }
              }}
            />
          ) : null}
        </Box>
      ))}
      {columns.length === 0 && bindings.isSuccess ? (
        <Typography color="warning" size="text-xs">
          {t('message.ontology-property-not-bound')}
        </Typography>
      ) : null}
      {renderEditor()}
    </Box>
  );
};

export default OntologyPropertyBindings;
