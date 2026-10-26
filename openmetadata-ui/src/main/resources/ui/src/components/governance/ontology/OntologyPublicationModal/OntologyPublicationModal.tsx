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
  ButtonUtility,
  Dialog,
  Modal,
  ModalOverlay,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { XClose } from '@openmetadata/ui-core-components/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ResourceEntity } from '../../../../enums/permissions.enum';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { useEntityPermissions } from '../../../../hooks/useEntityPermissions/useEntityPermissions';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import OntologyReleasePanel from '../OntologyReleasePanel/OntologyReleasePanel';

type PublicationTab = 'changes' | 'releases';

type OntologyPublicationModalProps = {
  readonly canEdit: boolean;
  readonly onClose: () => void;
  readonly onOpenTask?: (taskId: string) => void;
  readonly initialTab?: PublicationTab;
} & (
  | {
      readonly ontology: Ontology;
      readonly ontologies?: never;
      readonly onSelectOntology?: never;
      readonly initialOntology?: never;
    }
  | {
      readonly ontology?: undefined;
      readonly ontologies: Ontology[];
      readonly onSelectOntology?: (ontology: Ontology) => void;
      readonly initialOntology?: Ontology;
    }
);

const OntologyPublicationModal = ({
  canEdit,
  ontology,
  ontologies = [],
  initialOntology,
  initialTab = 'changes',
  onClose,
  onOpenTask,
}: OntologyPublicationModalProps) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<PublicationTab>(initialTab);
  const [selectedOwner, setSelectedOwner] = useState(initialOntology);
  const owner = ontology ?? selectedOwner;
  const { canEditAll } = useEntityPermissions(
    ResourceEntity.ONTOLOGY,
    { id: owner?.id ?? '' },
    { enabled: !ontology && Boolean(owner), deleted: owner?.deleted }
  );

  return (
    <ModalOverlay
      isDismissable
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}>
      <Modal>
        <Dialog
          aria-labelledby="ontology-publication-title"
          dividers="scroll"
          width={820}
          onClose={onClose}>
          <Tabs
            selectedKey={activeTab}
            onSelectionChange={(key) => {
              if (key === 'changes' || key === 'releases') {
                setActiveTab(key);
              }
            }}>
            <div
              className="tw:flex tw:max-h-[88vh] tw:flex-col tw:overflow-hidden tw:font-body"
              data-testid="ontology-publication-modal">
              <div className="tw:flex tw:items-center tw:gap-3 tw:border-b tw:border-secondary tw:py-4 tw:pr-14 tw:pl-5">
                <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col">
                  <Typography
                    id="ontology-publication-title"
                    role="heading"
                    size="text-md"
                    weight="bold">
                    {t('label.review-publish')}
                  </Typography>
                  <Typography color="secondary" size="text-xs">
                    {owner
                      ? getEntityName(owner)
                      : t('label.select-entity', {
                          entity: t('label.ontology'),
                        })}
                  </Typography>
                </div>
                {owner && (
                  <Tabs.List
                    aria-label={t('label.review-publish')}
                    size="sm"
                    type="button-minimal">
                    <Tabs.Item
                      data-testid="ontology-publication-tab-changes"
                      id="changes"
                      label={t('label.change-plural')}
                    />
                    <Tabs.Item
                      data-testid="ontology-publication-tab-releases"
                      id="releases"
                      label={t('label.release-plural')}
                    />
                  </Tabs.List>
                )}
                <ButtonUtility
                  color="tertiary"
                  icon={XClose}
                  size="sm"
                  tooltip={t('label.close')}
                  onClick={onClose}
                />
              </div>
              <div className="tw:min-h-0 tw:flex-1 tw:overflow-auto tw:p-5">
                {owner ? (
                  <Tabs.Panel id={activeTab}>
                    {!ontology && (
                      <Button
                        color="link-color"
                        size="sm"
                        onPress={() => setSelectedOwner(undefined)}>
                        {t('label.change-ontology')}
                      </Button>
                    )}
                    <OntologyReleasePanel
                      canEdit={ontology ? canEdit : canEditAll}
                      key={owner.id}
                      ontology={owner}
                      view={activeTab}
                      onOpenTask={onOpenTask}
                    />
                  </Tabs.Panel>
                ) : (
                  <div
                    className="tw:flex tw:flex-col tw:gap-3"
                    data-testid="ontology-publication-picker">
                    {ontologies.length === 0 ? (
                      <Typography>{t('message.no-data-available')}</Typography>
                    ) : (
                      ontologies.map((item) => (
                        <Button
                          color="secondary"
                          data-testid={`ontology-publication-select-${item.id}`}
                          key={item.id}
                          onPress={() => setSelectedOwner(item)}>
                          {getEntityName(item)}
                        </Button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </Tabs>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default OntologyPublicationModal;
