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

import { Space, Typography } from 'antd';
import { cloneDeep, isEmpty, isEqual } from 'lodash';
import { useCallback, useEffect, useState } from 'react';
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
} from '../../../../utils/EntityVersionUtils';
import { renderReferenceElement } from '../../../../utils/GlossaryUtils';
import ExpandableCard from '../../../common/ExpandableCard/ExpandableCard';
import {
  EditIconButton,
  PlusIconButton,
} from '../../../common/IconButtons/EditIconButton';
import { useGenericContext } from '../../../Customization/GenericProvider/GenericProvider';
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

  const handleReferencesSave = async (
    newReferences: TermReference[],
    updateState?: boolean
  ) => {
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
        if (updateState) {
          setReferences(updatedRef);
        }
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
      <div className="d-flex flex-wrap">
        {unchangedReferences.map((reference) =>
          renderReferenceElement(reference)
        )}
        {addedReferences.map((reference) =>
          renderReferenceElement(reference, { added: true })
        )}
        {deletedReferences.map((reference) =>
          renderReferenceElement(reference, { removed: true })
        )}
      </div>
    );
  }, [glossaryTerm]);

  const header = (
    <Space
      className="w-full"
      data-testid={`section-${t('label.reference-plural')}`}>
      <Typography.Text className="text-sm font-medium">
        {t('label.reference-plural')}
      </Typography.Text>
      {permissions.EditAll &&
        (isEmpty(references) ? (
          <PlusIconButton
            data-testid="term-references-add-button"
            size="small"
            title={t('label.add-entity', {
              entity: t('label.reference-plural'),
            })}
            onClick={() => {
              setIsViewMode(false);
            }}
          />
        ) : (
          <EditIconButton
            newLook
            data-testid="edit-button"
            disabled={!permissions.EditAll}
            size="small"
            onClick={() => setIsViewMode(false)}
          />
        ))}
    </Space>
  );

  return (
    <>
      <ExpandableCard
        cardProps={{
          title: header,
        }}
        dataTestId="references-container"
        isExpandDisabled={isEmpty(references)}>
        {isVersionView ? (
          getVersionReferenceElements()
        ) : !permissions.EditAll || !isEmpty(references) ? (
          <div className="d-flex flex-wrap">
            {references.map((ref) => renderReferenceElement(ref))}
            {!permissions.EditAll && references.length === 0 && (
              <div>{NO_DATA_PLACEHOLDER}</div>
            )}
          </div>
        ) : null}
      </ExpandableCard>

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
