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
  Button,
  Dialog,
  Dropdown,
  Modal,
  ModalOverlay,
  Select,
} from '@openmetadata/ui-core-components';
import {
  Download01,
  SwitchVertical01,
  Upload01,
} from '@openmetadata/ui-core-components/icons';
import { ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ResourceEntity } from '../../enums/permissions.enum';
import { Glossary } from '../../generated/entity/data/glossary';
import { Ontology } from '../../generated/entity/data/ontology';
import { useOntologyDraftGuard } from '../../hooks/governance/ontology/useOntologyDraftGuard';
import { useIsAiMode } from '../../hooks/useAppMode';
import { useEntityPermissions } from '../../hooks/useEntityPermissions/useEntityPermissions';
import { getEntityName } from '../../utils/EntityNameUtils';
import OntologyNativeImportDialog from '../governance/ontology/OntologyNativeImportDialog/OntologyNativeImportDialog';
import OntologyReleaseExportModal from '../governance/ontology/OntologyReleaseExportModal/OntologyReleaseExportModal';
import OntologyImportExportModal from './OntologyImportExportModal';

interface ImportExportCounts {
  readonly relationCount: string;
  readonly termCount: string;
}

interface GlossaryImportExportProps extends ImportExportCounts {
  readonly kind: 'glossary';
  readonly glossary?: Glossary;
  readonly glossaries: Glossary[];
  readonly isAdminUser: boolean;
}

interface NativeOntologyExportProps {
  readonly kind: 'ontology';
  readonly ontology: Ontology;
  readonly canImport: boolean;
  readonly onApplied: () => void;
  readonly onOpen?: () => void;
}

type OntologyImportExportMenuProps =
  | GlossaryImportExportProps
  | NativeOntologyExportProps
  | {
      readonly kind: 'allOntologies';
      readonly isCatalogEmpty: boolean;
      readonly ontologies: Ontology[];
      readonly onApplied: () => void;
    };

const OntologyImportExportMenu = (props: OntologyImportExportMenuProps) => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
  const [isOpen, setIsOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<'export' | 'import'>('export');
  const guard = useOntologyDraftGuard();
  const [selectedOwner, setSelectedOwner] = useState<Ontology>();
  const { canEditAll } = useEntityPermissions(
    ResourceEntity.ONTOLOGY,
    { id: selectedOwner?.id ?? '' },
    {
      enabled: props.kind === 'allOntologies' && Boolean(selectedOwner),
      deleted: selectedOwner?.deleted,
    }
  );
  const options = useMemo(
    () =>
      props.kind === 'allOntologies'
        ? props.ontologies.map((owner) => ({
            id: owner.id,
            label: getEntityName(owner),
            isDisabled: owner.deleted,
          }))
        : [],
    [props]
  );
  const renderModal = (): ReactNode => {
    if (!isOpen) {
      return null;
    }
    if (props.kind === 'allOntologies') {
      if (props.isCatalogEmpty) {
        return <OntologyNativeImportDialog onClose={() => setIsOpen(false)} />;
      }
      if (selectedOwner) {
        return (
          <OntologyReleaseExportModal
            canImport={canEditAll}
            ontology={selectedOwner}
            onApplied={props.onApplied}
            onClose={() => {
              setSelectedOwner(undefined);
              setIsOpen(false);
            }}
          />
        );
      }

      return (
        <ModalOverlay
          isDismissable
          isOpen
          onOpenChange={(open) => setIsOpen(open)}>
          <Modal>
            <Dialog
              dividers="scroll"
              title={t('label.import-export')}
              onClose={() => setIsOpen(false)}>
              <Dialog.Content>
                <Select
                  data-testid="ontology-import-target-picker"
                  items={options}
                  label={t('label.select-entity', {
                    entity: t('label.ontology'),
                  })}
                  selectedKey={null}
                  onSelectionChange={(key) =>
                    setSelectedOwner(
                      props.ontologies.find((owner) => owner.id === key)
                    )
                  }>
                  {(item) => (
                    <Select.Item
                      id={item.id}
                      isDisabled={item.isDisabled}
                      label={item.label}
                    />
                  )}
                </Select>
              </Dialog.Content>
            </Dialog>
          </Modal>
        </ModalOverlay>
      );
    }
    if (props.kind === 'ontology') {
      return (
        <OntologyReleaseExportModal
          canImport={props.canImport}
          initialTab={initialTab}
          ontology={props.ontology}
          onApplied={props.onApplied}
          onClose={() => setIsOpen(false)}
        />
      );
    }

    return (
      <OntologyImportExportModal
        glossaries={props.glossaries}
        glossary={props.glossary}
        isAdminUser={props.isAdminUser}
        relationCount={props.relationCount}
        termCount={props.termCount}
        onClose={() => setIsOpen(false)}
      />
    );
  };

  const open = (tab: 'export' | 'import') =>
    guard(() => {
      if (props.kind === 'ontology') {
        props.onOpen?.();
      }
      setInitialTab(tab);
      setIsOpen(true);
    });

  // One ontology offers Import and Export as two actions, each opening its tab.
  if (props.kind === 'ontology') {
    return (
      <>
        <Dropdown.Root>
          <Button
            aria-label={t('label.import-export')}
            color="secondary"
            data-testid="ontology-import-export-trigger"
            iconLeading={Download01}
            size="sm"
            tooltip={t('label.import-export')}
          />
          <Dropdown.Popover placement="bottom end">
            <Dropdown.Menu
              aria-label={t('label.import-export')}
              onAction={(key) => open(key === 'import' ? 'import' : 'export')}>
              {props.canImport ? (
                <Dropdown.Item
                  data-testid="ontology-import-menu-item"
                  icon={Upload01}
                  id="import"
                  label={t('label.import')}
                />
              ) : null}
              <Dropdown.Item
                data-testid="ontology-export-menu-item"
                icon={Download01}
                id="export"
                label={t('label.export')}
              />
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
        {renderModal()}
      </>
    );
  }

  return (
    <>
      <Button
        aria-label={t('label.import-export')}
        color="secondary"
        data-testid="ontology-import-export-trigger"
        iconLeading={isAiMode ? Download01 : SwitchVertical01}
        size="sm"
        tooltip={t('label.import-export')}
        onPress={() => guard(() => setIsOpen(true))}
      />
      {renderModal()}
    </>
  );
};

export default OntologyImportExportMenu;
