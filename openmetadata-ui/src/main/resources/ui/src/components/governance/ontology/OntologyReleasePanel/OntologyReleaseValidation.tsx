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
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Ontology } from '../../../../generated/entity/data/ontology';
import { OntologyRelease } from '../../../../generated/entity/data/ontologyRelease';
import { getOntologyReleaseStructure } from '../../../../rest/ontologyAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';

const OntologyReleaseValidation = ({
  ontology,
  release,
}: {
  ontology: Ontology;
  release?: OntologyRelease;
}) => {
  const { t } = useTranslation();
  const structure = useQuery({
    queryKey: [
      'ontology-release-structure',
      release?.id,
      release?.contentDigest,
    ],
    enabled: Boolean(release),
    queryFn: async () => {
      if (!release) {
        throw new Error('Missing ontology release');
      }
      const report = await getOntologyReleaseStructure(release.id);
      if (
        report.releaseId !== release.id ||
        report.contentDigest !== release.contentDigest
      ) {
        throw new Error(
          'Ontology structural report does not match the captured release'
        );
      }

      return report;
    },
    retry: false,
    gcTime: 0,
  });
  const reviewers = (release?.reviewers ?? ontology.reviewers ?? []).filter(
    (reviewer) => !reviewer.deleted
  );

  const structuralStatus = () => {
    if (!structure.isSuccess) {
      return t('label.not-checked');
    }

    return t(structure.data.valid ? 'label.passed' : 'label.failed');
  };

  return (
    <Box direction="col" gap={4}>
      <Card size="sm">
        <Card.Header title={t('label.validation')} />
        <Card.Content>
          <Box direction="col" gap={3}>
            <Typography color="secondary" size="text-xs">
              {release
                ? t('message.ontology-captured-validation', {
                    version: release.semanticVersion ?? release.releaseRevision,
                  })
                : t('message.ontology-structure-after-capture')}
            </Typography>
            <Typography size="text-sm">
              {t('label.structural-validation')}: {structuralStatus()}
            </Typography>
            {structure.isSuccess && !structure.data.valid && (
              <Typography size="text-sm">
                {t('message.ontology-structure-violations', {
                  count: structure.data.violationCount,
                })}
              </Typography>
            )}
            {structure.isError && (
              <Alert variant="error">
                {t('message.ontology-review-unavailable')}
                <Button
                  color="secondary"
                  size="sm"
                  onPress={() => void structure.refetch()}>
                  {t('label.retry')}
                </Button>
              </Alert>
            )}
            <Typography size="text-sm">
              {t('label.logical-consistency')}: {t('label.not-checked')}
            </Typography>
          </Box>
        </Card.Content>
      </Card>
      <Card size="sm">
        <Card.Header title={t('label.reviewer-plural')} />
        <Card.Content>
          <Box direction="col" gap={2}>
            <Typography color="secondary" size="text-xs">
              {t('message.ontology-configured-reviewers')}
            </Typography>
            {reviewers.length ? (
              reviewers.map((reviewer) => (
                <Typography key={reviewer.id} size="text-sm">
                  {getEntityName(reviewer)}
                </Typography>
              ))
            ) : (
              <Typography size="text-sm">
                {t('message.ontology-no-reviewers')}
              </Typography>
            )}
            {release && (
              <Typography size="text-sm">
                {t(
                  `label.${release.entityStatus
                    .toLowerCase()
                    .replaceAll(' ', '-')}`
                )}
              </Typography>
            )}
          </Box>
        </Card.Content>
      </Card>
    </Box>
  );
};

export default OntologyReleaseValidation;
