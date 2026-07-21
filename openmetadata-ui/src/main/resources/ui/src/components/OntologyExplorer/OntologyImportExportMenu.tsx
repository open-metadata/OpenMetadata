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
import { Download01 } from '@untitledui/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Glossary } from '../../generated/entity/data/glossary';
import OntologyImportExportModal from './OntologyImportExportModal';

interface OntologyImportExportMenuProps {
  readonly glossary?: Glossary;
  readonly glossaries: Glossary[];
  readonly isAdminUser: boolean;
  readonly termCount: string;
  readonly relationCount: string;
}

const OntologyImportExportMenu = ({
  glossary,
  glossaries,
  isAdminUser,
  termCount,
  relationCount,
}: OntologyImportExportMenuProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        className="tw:gap-[7px]! tw:rounded-[9px]! tw:border tw:border-primary tw:px-3! tw:py-[7px]! tw:text-xs! tw:font-semibold! tw:shadow-none! tw:ring-0! tw:before:hidden"
        color="secondary"
        data-testid="ontology-import-export-trigger"
        iconLeading={
          <Download01 className="tw:size-[15px] tw:text-fg-brand-primary" />
        }
        size="sm"
        onPress={() => setIsOpen(true)}>
        {t('label.import-export')}
      </Button>
      {isOpen ? (
        <OntologyImportExportModal
          glossaries={glossaries}
          glossary={glossary}
          isAdminUser={isAdminUser}
          relationCount={relationCount}
          termCount={termCount}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </>
  );
};

export default OntologyImportExportMenu;
