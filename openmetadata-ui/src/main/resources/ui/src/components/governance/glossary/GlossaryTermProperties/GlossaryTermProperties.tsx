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
  Badge,
  Box,
  Button,
  Table,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus } from '@openmetadata/ui-core-components/icons';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlossaryTerm } from '../../../../generated/entity/data/glossaryTerm';
import { useGlossaryTermPropertyPatch } from '../../../../hooks/governance/glossary/useGlossaryTermPropertyPatch';
import { GlossaryTermPropertyMode } from '../../../../utils/governance/glossary/GlossaryTermProperties.types';
import {
  buildResetPatch,
  getPropertyCounts,
  sortEffectiveProperties,
} from '../../../../utils/governance/glossary/GlossaryTermProperties.utils';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import WidgetCard from '../../../common/WidgetCard/WidgetCard';
import { useGenericContext } from '../../../Customization/GenericProvider/GenericContext';
import GlossaryTermPropertyDeleteModal from './GlossaryTermPropertyDeleteModal';
import GlossaryTermPropertyModal from './GlossaryTermPropertyModal';
import GlossaryTermPropertyRow from './GlossaryTermPropertyRow';

interface ModalState {
  mode: GlossaryTermPropertyMode;
  propertyName?: string;
}

const GlossaryTermProperties = () => {
  const { t } = useTranslation();
  const {
    data: glossaryTerm,
    permissions,
    isVersionView,
  } = useGenericContext<GlossaryTerm>();
  const { canEditGlossaryTermProperties } = useMemo(
    () => getDerivedPermissionFlags(permissions, glossaryTerm.deleted),
    [permissions, glossaryTerm.deleted]
  );
  const canEdit = canEditGlossaryTermProperties && !isVersionView;
  const { applyPatch } = useGlossaryTermPropertyPatch(glossaryTerm);
  const [modal, setModal] = useState<ModalState>();
  const [deleteName, setDeleteName] = useState<string>();

  const rows = useMemo(
    () => sortEffectiveProperties(glossaryTerm.effectiveProperties),
    [glossaryTerm.effectiveProperties]
  );
  const tableItems = useMemo(
    () => rows.map((entry) => ({ ...entry, id: entry.property.name })),
    [rows]
  );
  const counts = useMemo(() => getPropertyCounts(rows), [rows]);
  const deleteTarget = rows.find(
    (entry) => !entry.inherited && entry.property.name === deleteName
  )?.property;
  const childCount = glossaryTerm.childrenCount ?? 0;

  const closeModal = useCallback(() => setModal(undefined), []);
  const closeDelete = useCallback(() => setDeleteName(undefined), []);
  const handleReset = useCallback(
    (name: string) => applyPatch((current) => buildResetPatch(current, name)),
    [applyPatch]
  );

  return (
    <WidgetCard
      dataTestId="glossary-term-properties"
      headerActions={
        canEdit ? (
          <Button
            color="secondary"
            data-testid="add-property-button"
            iconLeading={Plus}
            size="sm"
            onPress={() => setModal({ mode: 'new' })}>
            {t('label.add-property')}
          </Button>
        ) : null
      }
      headerExtra={
        rows.length > 0 ? (
          <Badge
            color="gray"
            data-testid="glossary-term-properties-count"
            size="sm"
            type="color">
            {rows.length}
          </Badge>
        ) : null
      }
      title={t('label.property-plural')}>
      {rows.length === 0 ? (
        <Typography
          color="secondary"
          data-testid="glossary-term-properties-empty"
          size="text-sm">
          {t('message.glossary-term-properties-empty')}
        </Typography>
      ) : (
        <Box direction="col" gap={3}>
          <Typography
            color="secondary"
            data-testid="glossary-term-properties-summary"
            size="text-xs">
            {[
              t('message.glossary-term-properties-summary', {
                own: counts.own,
                inherited: counts.inherited,
              }),
              ...(childCount > 0
                ? [
                    t('message.child-terms-inherit-these', {
                      count: childCount,
                    }),
                  ]
                : []),
            ].join(' · ')}
          </Typography>
          <Table
            aria-label={t('label.property-plural')}
            data-testid="glossary-term-properties-table"
            size="sm">
            <Table.Header>
              <Table.Head isRowHeader id="property" label={t('label.name')} />
              <Table.Head id="type" label={t('label.type')} />
              <Table.Head id="value" label={t('label.value')} />
              <Table.Head id="source" label={t('label.source')} />
              <Table.Head id="actions" />
            </Table.Header>
            <Table.Body items={tableItems}>
              {(entry) => (
                <GlossaryTermPropertyRow
                  canEdit={canEdit}
                  entry={entry}
                  termId={glossaryTerm.id}
                  onDelete={setDeleteName}
                  onEdit={(name, mode) =>
                    setModal({ mode, propertyName: name })
                  }
                  onReset={handleReset}
                />
              )}
            </Table.Body>
          </Table>
        </Box>
      )}
      {modal && (
        <GlossaryTermPropertyModal
          mode={modal.mode}
          propertyName={modal.propertyName}
          term={glossaryTerm}
          onClose={closeModal}
        />
      )}
      {deleteTarget && (
        <GlossaryTermPropertyDeleteModal
          property={deleteTarget}
          term={glossaryTerm}
          onClose={closeDelete}
        />
      )}
    </WidgetCard>
  );
};

export default GlossaryTermProperties;
