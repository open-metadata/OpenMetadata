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
  Modal,
  ModalOverlay,
  Select,
} from '@openmetadata/ui-core-components';
import { SwitchVertical01 } from '@openmetadata/ui-core-components/icons';
import { ReactNode, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ResourceEntity } from '../../enums/permissions.enum';
import { Glossary } from '../../generated/entity/data/glossary';
import { Ontology } from '../../generated/entity/data/ontology';
import { useEntityPermissions } from '../../hooks/useEntityPermissions/useEntityPermissions';
import { getEntityName } from '../../utils/EntityNameUtils';
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
}

type OntologyImportExportMenuProps =
  | GlossaryImportExportProps
  | NativeOntologyExportProps
  | {
      readonly kind: 'allOntologies';
      readonly ontologies: Ontology[];
      readonly onApplied: () => void;
    };

const OntologyImportExportMenu = (props: OntologyImportExportMenuProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
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

  return (
    <>
      <Button
        aria-label={t('label.import-export')}
        color="secondary"
        data-testid="ontology-import-export-trigger"
        iconLeading={SwitchVertical01}
        size="sm"
        tooltip={t('label.import-export')}
        onPress={() => setIsOpen(true)}
      />
      {renderModal()}
    </>
  );
};

export default OntologyImportExportMenu;
