/*
 *  Copyright 2022 Collate.
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

import { cloneDeep, isEmpty, isEqual } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../../constants/constants';
import { EntityField } from '../../../../constants/Feeds.constants';
import {
  GlossaryTerm,
  TermReference,
} from '../../../../generated/entity/data/glossaryTerm';
import { ChangeDescription } from '../../../../generated/entity/type';
import {
  getChangedEntityNewValue,
  getChangedEntityOldValue,
  getDiffByFieldName,
} from '../../../../utils/EntityDiffPureUtils';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import {
  WidgetEditButton,
  WidgetPlusButton,
} from '../../../common/WidgetActionButton/WidgetActionButton';
import WidgetCard from '../../../common/WidgetCard/WidgetCard';
import { useGenericContext } from '../../../Customization/GenericProvider/GenericContext';
import { ReferenceBadge } from '../../GlossaryTermBadges/GlossaryTermBadges';
import GlossaryTermReferencesModal from '../GlossaryTermReferencesModal.component';

const GlossaryTermReferences = () => {
  const [references, setReferences] = useState<TermReference[]>([]);
  const [isViewMode, setIsViewMode] = useState<boolean>(true);
  const {
    data: glossaryTerm,
    onUpdate: onGlossaryTermUpdate,
    isVersionView,
    permissions,
  } = useGenericContext<GlossaryTerm>();
  const { t } = useTranslation();

  // Consumer via useGenericContext(). No `deleted` argument: the old expressions here
  // never gated on glossaryTerm.deleted, only on a bare EditAll read, so
  // getDerivedPermissionFlags defaults to its `deleted = false` — nothing to gate.
  const { canEditAll } = useMemo(
    () => getDerivedPermissionFlags(permissions),
    [permissions]
  );

  const handleReferencesSave = async (newReferences: TermReference[]) => {
    try {
      const updatedRef = newReferences.filter(
        (ref) => ref.endpoint && ref.name
      );
      if (!isEqual(updatedRef, glossaryTerm.references)) {
        let updatedGlossaryTerm = cloneDeep(glossaryTerm);
        updatedGlossaryTerm = {
          ...updatedGlossaryTerm,
          references: updatedRef,
        };

        await onGlossaryTermUpdate(updatedGlossaryTerm);
      }
      setIsViewMode(true);
    } catch (error) {
      // Added catch block to prevent uncaught promise
    }
  };

  useEffect(() => {
    setReferences(glossaryTerm.references ? glossaryTerm.references : []);
  }, [glossaryTerm.references]);

  const getVersionReferenceElements = useCallback(() => {
    const changeDescription = glossaryTerm.changeDescription;
    const referencesDiff = getDiffByFieldName(
      EntityField.REFERENCES,
      changeDescription as ChangeDescription
    );

    const addedReferences: TermReference[] = JSON.parse(
      getChangedEntityNewValue(referencesDiff) ?? '[]'
    );
    const deletedReferences: TermReference[] = JSON.parse(
      getChangedEntityOldValue(referencesDiff) ?? '[]'
    );

    const unchangedReferences = glossaryTerm.references
      ? glossaryTerm.references.filter(
          (reference) =>
            !addedReferences.find(
              (addedReference: TermReference) =>
                addedReference.name === reference.name
            )
        )
      : [];

    const noSynonyms =
      isEmpty(unchangedReferences) &&
      isEmpty(addedReferences) &&
      isEmpty(deletedReferences);

    if (noSynonyms) {
      return <div>{NO_DATA_PLACEHOLDER}</div>;
    }

    return (
      <div className="tw:flex tw:flex-wrap tw:gap-1">
        {unchangedReferences.map((reference) => (
          <ReferenceBadge key={reference.name} reference={reference} />
        ))}
        {addedReferences.map((reference) => (
          <ReferenceBadge
            key={reference.name}
            reference={reference}
            versionStatus={{ added: true }}
          />
        ))}
        {deletedReferences.map((reference) => (
          <ReferenceBadge
            key={reference.name}
            reference={reference}
            versionStatus={{ removed: true }}
          />
        ))}
      </div>
    );
  }, [glossaryTerm]);

  const renderHeaderExtra = () => {
    if (!canEditAll) {
      return null;
    }

    return isEmpty(references) ? (
      <WidgetPlusButton
        data-testid="term-references-add-button"
        title={t('label.add-entity', {
          entity: t('label.reference-plural'),
        })}
        onClick={() => setIsViewMode(false)}
      />
    ) : (
      <WidgetEditButton
        data-testid="edit-button"
        title={t('label.edit-entity', {
          entity: t('label.reference-plural'),
        })}
        onClick={() => setIsViewMode(false)}
      />
    );
  };

  const renderReferences = () => {
    if (isVersionView) {
      return getVersionReferenceElements();
    }
    if (isEmpty(references)) {
      return canEditAll ? null : <div>{NO_DATA_PLACEHOLDER}</div>;
    }

    return (
      <div className="tw:flex tw:flex-wrap tw:gap-1">
        {references.map((ref) => (
          <ReferenceBadge key={ref.name} reference={ref} />
        ))}
      </div>
    );
  };

  // WidgetCard hides the body of a disabled card, so only disable it when
  // there is nothing to show; read-only users still see the placeholder.
  const referencesBody = renderReferences();

  return (
    <>
      <WidgetCard
        dataTestId="references-container"
        headerExtra={renderHeaderExtra()}
        isExpandDisabled={!referencesBody}
        title={t('label.reference-plural')}>
        {referencesBody}
      </WidgetCard>

      <GlossaryTermReferencesModal
        isVisible={!isViewMode}
        references={references || []}
        onClose={() => {
          setIsViewMode(true);
        }}
        onSave={handleReferencesSave}
      />
    </>
  );
};

export default GlossaryTermReferences;
