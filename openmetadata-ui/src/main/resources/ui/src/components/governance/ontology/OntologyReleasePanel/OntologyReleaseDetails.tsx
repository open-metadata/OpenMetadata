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
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Dialog,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { LogicalCheck } from '../../../../generated/api/data/ontologyReleaseValidation';
import {
  ApprovalBasis,
  EntityStatus,
  OntologyRelease,
} from '../../../../generated/entity/data/ontologyRelease';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import OntologyReviewRelease from '../OntologyReviewPanel/OntologyReviewRelease';
import OntologyReleaseEvents from './OntologyReleaseEvents';
import OntologyReleaseExport from './OntologyReleaseExport';
import { useReleaseValidation } from './OntologyReleaseValidation';

interface OntologyReleaseDetailsProps {
  release: OntologyRelease;
  isActive: boolean;
  showExport?: boolean;
  canPublish: boolean;
  /** The release in force; a release older than it is a rollback target. */
  activeRelease?: OntologyRelease;
  ontologyName: string;
  onActivate: () => Promise<void>;
}

const versionLabel = (release: OntologyRelease) =>
  release.semanticVersion ? 'v' + release.semanticVersion : release.name;

interface ActivationActionsProps {
  release: OntologyRelease;
  /** Set only when the release is older than the one in force. */
  activeRelease?: OntologyRelease;
  canActivate: boolean;
  ontologyName: string;
  onActivate: () => Promise<void>;
}

const ActivationActions = ({
  release,
  activeRelease,
  canActivate,
  ontologyName,
  onActivate,
}: ActivationActionsProps) => {
  const { t } = useTranslation();
  const [isConfirming, setIsConfirming] = useState(false);
  if (!activeRelease) {
    return (
      <Button color="primary" isDisabled={!canActivate} onPress={onActivate}>
        {t('label.activate-release')}
      </Button>
    );
  }

  return (
    <>
      <Button
        color="primary"
        data-testid="ontology-rollback-release"
        isDisabled={!canActivate}
        onPress={() => setIsConfirming(true)}>
        {t('label.roll-back-to-version', { version: versionLabel(release) })}
      </Button>
      <ModalOverlay
        isDismissable
        isOpen={isConfirming}
        onOpenChange={setIsConfirming}>
        <Modal>
          <Dialog
            dividers="scroll"
            title={t('message.ontology-rollback-confirm-title', {
              version: versionLabel(release),
            })}
            onClose={() => setIsConfirming(false)}>
            <Dialog.Content>
              <Typography data-testid="ontology-rollback-confirmation">
                {t('message.ontology-rollback-confirm', {
                  ontology: ontologyName,
                  current: versionLabel(activeRelease),
                  target: versionLabel(release),
                })}
              </Typography>
            </Dialog.Content>
            <Dialog.Footer>
              <Button color="secondary" onPress={() => setIsConfirming(false)}>
                {t('label.cancel')}
              </Button>
              <Button
                color="primary"
                data-testid="ontology-rollback-confirm"
                onPress={() => {
                  setIsConfirming(false);
                  void onActivate();
                }}>
                {t('label.roll-back')}
              </Button>
            </Dialog.Footer>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </>
  );
};

export const ReleaseActions = ({
  release,
  isActive,
  showExport,
  canPublish,
  activeRelease,
  ontologyName,
  onActivate,
  onOpenTask,
}: OntologyReleaseDetailsProps & {
  showExport: boolean;
  /** Opens the review task in place instead of navigating to it. */
  onOpenTask?: (taskId: string) => void;
}) => {
  const { t } = useTranslation();
  const isApproved = release.entityStatus === EntityStatus.Approved;
  const isRollback =
    !isActive &&
    activeRelease !== undefined &&
    release.releaseRevision < activeRelease.releaseRevision;

  return (
    <Box align="center" gap={3} wrap="wrap">
      {showExport && <OntologyReleaseExport releaseId={release.id} />}
      {release.reviewTask &&
        (onOpenTask ? (
          <Button
            color="secondary"
            data-testid="ontology-release-view-request"
            onPress={() =>
              release.reviewTask && onOpenTask(release.reviewTask)
            }>
            {t('label.view-request')}
          </Button>
        ) : (
          <Link to={`/tasks/${encodeURIComponent(release.reviewTask)}`}>
            {t('label.approval')}
          </Link>
        ))}
      {!isActive && (
        <ActivationActions
          activeRelease={isRollback ? activeRelease : undefined}
          canActivate={canPublish && isApproved}
          ontologyName={ontologyName}
          release={release}
          onActivate={onActivate}
        />
      )}
    </Box>
  );
};

const OntologyReleaseDetails = ({
  release,
  isActive,
  showExport = true,
  canPublish,
  activeRelease,
  ontologyName,
  onActivate,
}: OntologyReleaseDetailsProps) => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
  const statusLabel = t(
    `label.${release.entityStatus.toLowerCase().replaceAll(' ', '-')}`
  );

  const heading = versionLabel(release);
  const directPublish =
    release.approvalBasis === ApprovalBasis.NoReviewersConfigured ? (
      <Typography data-testid="ontology-release-direct" size="text-sm">
        {t('label.published-without-review')}
      </Typography>
    ) : null;

  const actions = (
    <ReleaseActions
      activeRelease={activeRelease}
      canPublish={canPublish}
      isActive={isActive}
      ontologyName={ontologyName}
      release={release}
      showExport={showExport}
      onActivate={onActivate}
    />
  );

  const validation = useReleaseValidation(release);
  const consistencyAlert =
    validation.data?.logicalCheck === LogicalCheck.NotRun ? (
      <Alert variant="warning">
        {t('message.ontology-consistency-not-run')}
      </Alert>
    ) : null;

  const history = (
    <>
      <OntologyReleaseEvents releaseId={release.id} />
      <OntologyReviewRelease
        baseReleaseId={release.baseReleaseId}
        inspectable={false}
        key={release.id}
        releaseId={release.id}
      />
    </>
  );

  if (isAiMode) {
    return (
      <Card data-testid="ontology-release-definition" size="md">
        <Card.Content>
          <Box direction="col" gap={4}>
            <Box align="center" gap={2} wrap="wrap">
              <Typography
                as="h3"
                className="not-prose tw:m-0 tw:text-primary"
                size="text-lg"
                weight="semibold">
                {heading}
              </Typography>
              <Badge color="gray" size="sm" type="pill-color">
                {statusLabel}
              </Badge>
              {isActive && (
                <Badge
                  color="success"
                  data-testid="ontology-active-release"
                  size="sm"
                  type="pill-color">
                  {t('label.active')}
                </Badge>
              )}
            </Box>
            {directPublish}
            {consistencyAlert}
            {actions}
            {history}
          </Box>
        </Card.Content>
      </Card>
    );
  }

  return (
    <Box data-testid="ontology-release-definition" direction="col" gap={3}>
      <Typography
        as="h3"
        className="not-prose tw:m-0 tw:text-primary"
        size="text-md"
        weight="semibold">
        {heading}
      </Typography>
      <Typography>{statusLabel}</Typography>
      {isActive && (
        <Typography data-testid="ontology-active-release">
          {t('label.active')}
        </Typography>
      )}
      {directPublish}
      {consistencyAlert}
      {actions}
      {history}
    </Box>
  );
};

export default OntologyReleaseDetails;
