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
  Box,
  Button,
  Dropdown,
  Typography,
} from '@openmetadata/ui-core-components';
import { ChevronDown } from '@openmetadata/ui-core-components/icons';
import { isAxiosError } from 'axios';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  EntityStatus,
  OntologyRelease,
} from '../../../../generated/entity/data/ontologyRelease';
import { exportOntologyRelease } from '../../../../rest/ontologyAPI';
import {
  EXPORT_FORMAT_TO_ACCEPT_HEADER,
  EXPORT_FORMAT_TO_FILE_EXTENSION,
  OntologyExportFormat,
} from '../../../../rest/rdfAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { downloadFile } from '../../../../utils/Export/ExportUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import OntologyReviewRelease from '../OntologyReviewPanel/OntologyReviewRelease';

interface OntologyReleaseDetailsProps {
  release: OntologyRelease;
  isActive: boolean;
  canPublish: boolean;
  onRequestApproval: () => Promise<void>;
  onActivate: () => Promise<void>;
}

const OntologyReleaseDetails = ({
  release,
  isActive,
  canPublish,
  onRequestApproval,
  onActivate,
}: OntologyReleaseDetailsProps) => {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const isApproved = release.entityStatus === EntityStatus.Approved;
  const canRequestReview = release.entityStatus === EntityStatus.Draft;

  const exportRelease = async (format: OntologyExportFormat) => {
    setIsExporting(true);
    try {
      const content = await exportOntologyRelease(release.id, format);
      downloadFile(
        content,
        `ontology-release-${release.id}.${EXPORT_FORMAT_TO_FILE_EXTENSION[format]}`,
        EXPORT_FORMAT_TO_ACCEPT_HEADER[format]
      );
    } catch (error) {
      showErrorToast(
        isAxiosError(error) ? error : t('server.unexpected-error')
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Box data-testid="ontology-release-definition" direction="col" gap={3}>
      <Typography as="h3" size="text-md" weight="semibold">
        {getEntityName(release)}
      </Typography>
      <Typography>
        {t(`label.${release.entityStatus.toLowerCase().replaceAll(' ', '-')}`)}
      </Typography>
      {isActive && (
        <Typography data-testid="ontology-active-release">
          {t('label.active')}
        </Typography>
      )}
      <Alert variant="warning">
        {t('message.ontology-consistency-not-run')}
      </Alert>
      <Box gap={3} wrap="wrap">
        <Dropdown.Root>
          <Button
            color="secondary"
            iconTrailing={ChevronDown}
            isDisabled={isExporting}
            isLoading={isExporting}>
            {t('label.export')}
          </Button>
          <Dropdown.Popover>
            <Dropdown.Menu aria-label={t('label.export')} selectionMode="none">
              <Dropdown.Item
                id="turtle"
                onAction={() => void exportRelease('turtle')}>
                {t('label.turtle-ttl')}
              </Dropdown.Item>
              <Dropdown.Item
                id="rdfxml"
                onAction={() => void exportRelease('rdfxml')}>
                {t('label.rdf-xml-rdf')}
              </Dropdown.Item>
              <Dropdown.Item
                id="ntriples"
                onAction={() => void exportRelease('ntriples')}>
                {t('label.n-triples-nt')}
              </Dropdown.Item>
              <Dropdown.Item
                id="jsonld"
                onAction={() => void exportRelease('jsonld')}>
                {t('label.json-ld')}
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
        {release.reviewTask && (
          <Link to={`/tasks/${encodeURIComponent(release.reviewTask)}`}>
            {t('label.approval')}
          </Link>
        )}
        {canRequestReview && (
          <Button
            color="secondary"
            isDisabled={!canPublish}
            onPress={onRequestApproval}>
            {t('label.request-approval')}
          </Button>
        )}
        <Button
          color="primary"
          isDisabled={!canPublish || isActive || !isApproved}
          onPress={onActivate}>
          {t('label.activate-release')}
        </Button>
      </Box>
      <OntologyReviewRelease
        baseReleaseId={release.baseReleaseId}
        key={release.id}
        releaseId={release.id}
      />
    </Box>
  );
};

export default OntologyReleaseDetails;
