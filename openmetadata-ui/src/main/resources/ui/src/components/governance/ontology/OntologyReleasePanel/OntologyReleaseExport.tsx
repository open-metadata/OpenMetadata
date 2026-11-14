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
import { useTranslation } from 'react-i18next';
import { useOntologyReleaseDownload } from '../../../../hooks/governance/ontology/useOntologyReleaseDownload';

const OntologyReleaseExport = ({ releaseId }: { releaseId: string }) => {
  const { t } = useTranslation();
  const { isExporting, exportRelease } = useOntologyReleaseDownload(releaseId);

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
          <Dropdown.Item id="skos" onAction={() => void exportRelease('skos')}>
            {t('label.skos-turtle')}
          </Dropdown.Item>
          <Dropdown.Item id="csv" onAction={() => void exportRelease('csv')}>
            {t('label.csv')}
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
