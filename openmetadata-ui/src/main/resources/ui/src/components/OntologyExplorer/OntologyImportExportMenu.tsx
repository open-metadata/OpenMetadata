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

import { Button } from '@openmetadata/ui-core-components';
import { SwitchVertical01 } from '@openmetadata/ui-core-components/icons';
import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Glossary } from '../../generated/entity/data/glossary';
import { Ontology } from '../../generated/entity/data/ontology';
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
  | NativeOntologyExportProps;

const OntologyImportExportMenu = (props: OntologyImportExportMenuProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  let modal: ReactNode = null;
  if (isOpen) {
    modal =
      props.kind === 'ontology' ? (
        <OntologyReleaseExportModal
          canImport={props.canImport}
          ontology={props.ontology}
          onApplied={props.onApplied}
          onClose={() => setIsOpen(false)}
        />
      ) : (
        <OntologyImportExportModal
          glossaries={props.glossaries}
          glossary={props.glossary}
          isAdminUser={props.isAdminUser}
          relationCount={props.relationCount}
          termCount={props.termCount}
          onClose={() => setIsOpen(false)}
        />
      );
  }

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
      {modal}
    </>
  );
};

export default OntologyImportExportMenu;
