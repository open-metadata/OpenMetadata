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

import { ButtonUtility } from '@openmetadata/ui-core-components';
import { Edit01 } from '@openmetadata/ui-core-components/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InspectorRemoveButton } from '../../../OntologyExplorer/OntologyInspectorSection';

interface OntologyRelationControlsProps {
  /** Opens the inline edit form, the same one Add uses. */
  readonly onEdit: () => void;
  readonly onDelete: () => Promise<boolean>;
}

/** Edit and delete for one relationship row in the concept panel. */
const OntologyRelationControls = ({
  onEdit,
  onDelete,
}: OntologyRelationControlsProps) => {
  const { t } = useTranslation();
  const [isBusy, setIsBusy] = useState(false);

  const remove = async () => {
    setIsBusy(true);
    await onDelete();
    setIsBusy(false);
  };

  return (
    <>
      <ButtonUtility
        data-testid="ontology-relation-edit"
        icon={Edit01}
        isDisabled={isBusy}
        size="sm"
        tooltip={t('label.edit-entity', { entity: t('label.relationship') })}
        onClick={onEdit}
      />
      <InspectorRemoveButton
        isDisabled={isBusy}
        label={t('label.delete-entity', { entity: t('label.relationship') })}
        testId="ontology-relation-delete"
        onRemove={() => void remove()}
      />
    </>
  );
};

export default OntologyRelationControls;
