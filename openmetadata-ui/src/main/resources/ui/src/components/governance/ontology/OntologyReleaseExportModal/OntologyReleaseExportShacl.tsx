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
  Typography,
} from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import {
  FindingSeverity,
  OntologyReleaseValidation,
} from '../../../../generated/api/data/ontologyReleaseValidation';

interface OntologyReleaseExportShaclProps {
  readonly isRunning: boolean;
  readonly report?: OntologyReleaseValidation;
  readonly onRun: () => void;
}

const OntologyReleaseExportShacl = ({
  isRunning,
  report,
  onRun,
}: OntologyReleaseExportShaclProps) => {
  const { t } = useTranslation();

  return (
    <Box
      className="tw:rounded-lg tw:border tw:border-secondary tw:p-4"
      data-testid="ontology-export-shacl"
      direction="col"
      gap={3}>
      <Box align="center" gap={3}>
        <Button
          color="secondary"
          data-testid="ontology-run-export-shacl"
          isLoading={isRunning}
          size="sm"
          onPress={onRun}>
          {t('label.run-shacl')}
        </Button>
        {report ? (
          <Typography
            data-testid="ontology-export-shacl-status"
            role="status"
            size="text-sm"
            weight="semibold">
            {t('message.shacl-violation-count', {
              count: report.shacl.violationCount,
            })}
          </Typography>
        ) : null}
      </Box>
      {report && !report.structure.valid ? (
        <Typography color="secondary" size="text-sm">
          {t('message.ontology-structure-violations', {
            count: report.structure.violationCount,
          })}
        </Typography>
      ) : null}
      {report && report.shacl.findings.length > 0 ? (
        <ul
          className="tw:m-0 tw:flex tw:max-h-48 tw:flex-col tw:gap-2 tw:overflow-auto tw:pl-4"
          data-testid="ontology-export-shacl-findings">
          {report.shacl.findings.map((finding) => (
            <li key={JSON.stringify(finding)}>
              <Badge
                color={
                  finding.severity === FindingSeverity.Violation
                    ? 'error'
                    : 'warning'
                }>
                {t(
                  finding.severity === FindingSeverity.Violation
                    ? 'label.violation'
                    : 'label.warning'
                )}
              </Badge>
              <Typography
                className="tw:whitespace-pre-wrap tw:break-words"
                size="text-sm">
                {finding.message}
              </Typography>
              <Typography
                className="tw:break-words"
                color="secondary"
                size="text-xs">
                {finding.focusIri}
              </Typography>
            </li>
          ))}
        </ul>
      ) : null}
    </Box>
  );
};

export default OntologyReleaseExportShacl;
