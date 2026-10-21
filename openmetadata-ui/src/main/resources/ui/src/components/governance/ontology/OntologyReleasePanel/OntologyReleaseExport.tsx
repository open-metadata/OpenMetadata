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
import { Button, Dropdown } from '@openmetadata/ui-core-components';
import { ChevronDown } from '@openmetadata/ui-core-components/icons';
import { isAxiosError } from 'axios';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { exportOntologyRelease } from '../../../../rest/ontologyAPI';
import {
  EXPORT_FORMAT_TO_ACCEPT_HEADER,
  EXPORT_FORMAT_TO_FILE_EXTENSION,
  OntologyExportFormat,
} from '../../../../rest/rdfAPI';
import { downloadFile } from '../../../../utils/Export/ExportUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';

const OntologyReleaseExport = ({ releaseId }: { releaseId: string }) => {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const exportRelease = async (format: OntologyExportFormat) => {
    setIsExporting(true);
    try {
      const content = await exportOntologyRelease(releaseId, format);
      downloadFile(
        content,
        `ontology-release-${releaseId}.${EXPORT_FORMAT_TO_FILE_EXTENSION[format]}`,
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
    <Dropdown.Root>
      <Button
        color="secondary"
        data-testid={`ontology-release-export-${releaseId}`}
        iconTrailing={ChevronDown}
        isDisabled={isExporting}
        isLoading={isExporting}
        size="sm">
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
  );
};

export default OntologyReleaseExport;
