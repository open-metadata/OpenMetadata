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
  Typography,
} from '@openmetadata/ui-core-components';
import { XClose } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import OntologyReleasePanel from '../OntologyReleasePanel/OntologyReleasePanel';

type PublicationTab = 'changes' | 'releases';

interface OntologyPublicationModalProps {
  readonly canEdit: boolean;
  readonly ontology: Ontology;
  readonly onClose: () => void;
}

const OntologyPublicationModal = ({
  canEdit,
  ontology,
  onClose,
}: OntologyPublicationModalProps) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<PublicationTab>('changes');

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
          width={820}
          onClose={onClose}>
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
                  {getEntityName(ontology)}
                </Typography>
              </div>
              <div className="tw:flex tw:gap-0.5 tw:rounded-lg tw:border tw:border-secondary tw:bg-tertiary tw:p-0.5">
                {(['changes', 'releases'] as const).map((tab) => (
                  <Button
                    noTextPadding
                    aria-pressed={activeTab === tab}
                    className={classNames(
                      'tw:rounded-md tw:px-4 tw:py-1.5 tw:text-sm tw:font-semibold',
                      activeTab === tab
                        ? 'tw:bg-primary tw:text-brand-secondary tw:shadow-xs'
                        : 'tw:bg-transparent tw:text-quaternary'
                    )}
                    color="tertiary"
                    data-testid={`ontology-publication-tab-${tab}`}
                    key={tab}
                    onClick={() => setActiveTab(tab)}>
                    {t(
                      tab === 'changes'
                        ? 'label.change-plural'
                        : 'label.release-plural'
                    )}
                  </Button>
                ))}
              </div>
              <ButtonUtility
                color="tertiary"
                icon={XClose}
                size="sm"
                tooltip={t('label.close')}
                onClick={onClose}
              />
            </div>
            <div className="tw:min-h-0 tw:flex-1 tw:overflow-auto tw:p-5">
              <OntologyReleasePanel
                canEdit={canEdit}
                key={`${ontology.id}:${activeTab}`}
                ontology={ontology}
                view={activeTab}
              />
            </div>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default OntologyPublicationModal;
