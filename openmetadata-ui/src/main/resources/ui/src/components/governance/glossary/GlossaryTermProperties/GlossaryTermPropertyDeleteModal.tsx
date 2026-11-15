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

import { AxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlossaryTermPropertyImpact } from '../../../../generated/api/data/glossaryTermPropertyImpact';
import { GlossaryTermProperty } from '../../../../generated/type/glossaryTermProperty';
import { useGlossaryTermPropertyPatch } from '../../../../hooks/governance/glossary/useGlossaryTermPropertyPatch';
import { getGlossaryTermPropertyImpact } from '../../../../rest/glossaryAPI';
import { GlossaryTermWithProperties } from '../../../../utils/governance/glossary/GlossaryTermProperties.types';
import {
  buildDeletePropertyPatch,
  getPropertyLabel,
} from '../../../../utils/governance/glossary/GlossaryTermProperties.utils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import DeleteModal from '../../../common/DeleteModal/DeleteModal';

interface GlossaryTermPropertyDeleteModalProps {
  term: GlossaryTermWithProperties;
  property: GlossaryTermProperty;
  onClose: () => void;
}

const GlossaryTermPropertyDeleteModal = ({
  term,
  property,
  onClose,
}: GlossaryTermPropertyDeleteModalProps) => {
  const { t } = useTranslation();
  const { applyPatch, isSaving } = useGlossaryTermPropertyPatch(term);
  const [impact, setImpact] = useState<GlossaryTermPropertyImpact>();

  useEffect(() => {
    let isCurrent = true;
    getGlossaryTermPropertyImpact(term.id, property.name)
      .then((result) => isCurrent && setImpact(result))
      .catch((error: AxiosError) => {
        if (isCurrent) {
          showErrorToast(error);
          onClose();
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [term.id, property.name, onClose]);

  const handleDelete = async () => {
    const deleted = await applyPatch((current) =>
      buildDeletePropertyPatch(current, property.name)
    );
    if (deleted) {
      onClose();
    }
  };

  const getMessage = () => {
    if (!impact) {
      return t('message.glossary-term-property-checking-impact');
    }
    if (impact.termsWithEntries === 0) {
      return t('message.glossary-term-property-delete-no-impact');
    }
    const terms = impact.sample
      .map((reference) => reference.fullyQualifiedName ?? reference.name)
      .join(', ');

    return t('message.glossary-term-property-delete-impact', {
      count: impact.termsWithEntries,
      terms,
    });
  };

  return (
    <DeleteModal
      open
      entityTitle={getPropertyLabel(property)}
      isDeleting={isSaving || !impact}
      message={getMessage()}
      onCancel={onClose}
      onDelete={handleDelete}
    />
  );
};

export default GlossaryTermPropertyDeleteModal;
