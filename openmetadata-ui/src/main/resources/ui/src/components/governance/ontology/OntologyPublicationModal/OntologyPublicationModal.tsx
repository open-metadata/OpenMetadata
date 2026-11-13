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
  ButtonUtility,
  Dialog,
  FeaturedIcon,
  Modal,
  ModalOverlay,
  Tabs,
  Typography,
} from '@openmetadata/ui-core-components';
import { ArrowUp, XClose } from '@openmetadata/ui-core-components/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import OntologyReleasePanel, {
  PublicationSummary,
} from '../OntologyReleasePanel/OntologyReleasePanel';

type PublicationTab = 'changes' | 'releases';

const CLASSIC_LAYOUT = {
  width: 820,
  body: 'tw:min-h-0 tw:flex-1 tw:overflow-auto tw:p-5',
};

const AI_LAYOUT = {
  width: 1280,
  body: 'tw:min-h-0 tw:flex-1 tw:overflow-auto tw:px-6 tw:pt-5',
};

interface PublicationHeaderProps {
  readonly owner: Ontology;
  readonly summary: PublicationSummary;
  readonly onClose: () => void;
}

const PublicationClassicHeader = ({
  owner,
  onClose,
}: PublicationHeaderProps) => {
  const { t } = useTranslation();

  return (
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
          {getEntityName(owner)}
        </Typography>
      </div>
      <Tabs.List
        aria-label={t('label.review-publish')}
        size="sm"
        type="button-border">
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
      <ButtonUtility
        icon={XClose}
        size="sm"
        tooltip={t('label.close')}
        onClick={onClose}
      />
    </div>
  );
};

const releasesLabel = (label: string, summary: PublicationSummary) => {
  if (!summary.releaseCount) {
    return label;
  }
  const more = summary.hasMoreReleases ? '+' : '';

  return `${label} (${summary.releaseCount}${more})`;
};

const PublicationAiHeader = ({
  owner,
  summary,
  onClose,
}: PublicationHeaderProps) => {
  const { t } = useTranslation();
  const ownerName = getEntityName(owner);

  return (
    <div className="tw:flex tw:items-center tw:gap-4 tw:border-b tw:border-secondary tw:px-6 tw:py-4">
      <FeaturedIcon color="gray" icon={ArrowUp} size="md" theme="modern" />
      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-1">
        <div className="tw:flex tw:min-w-0 tw:items-baseline tw:gap-1.5">
          <Typography
            className="tw:shrink-0"
            id="ontology-publication-title"
            role="heading"
            size="text-md"
            weight="semibold">
            {t('label.review-publish')}
          </Typography>
          <Typography
            as="span"
            className="tw:truncate"
            color="secondary"
            size="text-md">
            {`· ${ownerName}`}
          </Typography>
        </div>
        {summary.toVersion ? (
          <div
            className="tw:flex tw:items-center tw:gap-1.5"
            data-testid="ontology-publication-version-step">
            <Badge color="gray" size="sm" type="pill-color">
              {summary.fromVersion ?? t('label.draft')}
            </Badge>
            <Typography aria-hidden as="span" color="quaternary" size="text-xs">
              →
            </Typography>
            <Badge color="brand" size="sm" type="pill-color">
              {summary.toVersion}
            </Badge>
          </div>
        ) : null}
      </div>
      <Tabs.List
        aria-label={t('label.review-publish')}
        size="sm"
        type="button-border">
        <Tabs.Item
          data-testid="ontology-publication-tab-changes"
          id="changes"
          label={t('label.change-plural')}
        />
        <Tabs.Item
          data-testid="ontology-publication-tab-releases"
          id="releases"
          label={releasesLabel(t('label.release-plural'), summary)}
        />
      </Tabs.List>
      <ButtonUtility
        icon={XClose}
        size="sm"
        tooltip={t('label.close')}
        onClick={onClose}
      />
    </div>
  );
};

type OntologyPublicationModalProps = {
  readonly canEdit: boolean;
  readonly ontology: Ontology;
  readonly onClose: () => void;
  readonly onOpenTask?: (taskId: string) => void;
  readonly initialTab?: PublicationTab;
};

const OntologyPublicationModal = ({
  canEdit,
  ontology,
  initialTab = 'changes',
  onClose,
  onOpenTask,
}: OntologyPublicationModalProps) => {
  const isAiMode = useIsAiMode();
  const [activeTab, setActiveTab] = useState<PublicationTab>(initialTab);
  const [summary, setSummary] = useState<PublicationSummary>({});

  const layout = isAiMode ? AI_LAYOUT : CLASSIC_LAYOUT;
  const PublicationHeader = isAiMode
    ? PublicationAiHeader
    : PublicationClassicHeader;

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
          width={layout.width}
          onClose={onClose}>
          <Tabs
            selectedKey={activeTab}
            onSelectionChange={(key) => {
              if (key === 'changes' || key === 'releases') {
                setActiveTab(key);
              }
            }}>
            <div
              className="tw:flex tw:h-[88vh] tw:flex-col tw:overflow-hidden tw:font-body"
              data-testid="ontology-publication-modal">
              <PublicationHeader
                owner={ontology}
                summary={summary}
                onClose={onClose}
              />
              <div className={layout.body}>
                {/* One height for both tabs; the panel fills it so each footer sits at the bottom. */}
                <Tabs.Panel
                  className="tw:flex tw:min-h-full tw:flex-col"
                  id={activeTab}>
                  <OntologyReleasePanel
                    canEdit={canEdit}
                    key={ontology.id}
                    ontology={ontology}
                    view={activeTab}
                    onOpenTask={onOpenTask}
                    onSummaryChange={setSummary}
                  />
                </Tabs.Panel>
              </div>
            </div>
          </Tabs>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

export default OntologyPublicationModal;
