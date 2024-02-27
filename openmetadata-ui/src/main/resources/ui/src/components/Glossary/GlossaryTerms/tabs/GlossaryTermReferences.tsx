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

import { Button, Space, Tag, Tooltip, Typography } from 'antd';
import classNames from 'classnames';
import { t } from 'i18next';
import { cloneDeep, isEmpty, isEqual } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { ReactComponent as EditIcon } from '../../../../assets/svg/edit-new.svg';
import { ReactComponent as ExternalLinkIcon } from '../../../../assets/svg/external-links.svg';
import { ReactComponent as PlusIcon } from '../../../../assets/svg/plus-primary.svg';
import {
  DE_ACTIVE_COLOR,
  NO_DATA_PLACEHOLDER,
  SUCCESS_COLOR,
  TEXT_BODY_COLOR,
  TEXT_GREY_MUTED,
} from '../../../../constants/constants';
import { EntityField } from '../../../../constants/Feeds.constants';
import { NO_PERMISSION_FOR_ACTION } from '../../../../constants/HelperTextUtil';
import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
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
import { VersionStatus } from '../../../../utils/EntityVersionUtils.interface';
import TagButton from '../../../common/TagButton/TagButton.component';
import GlossaryTermReferencesModal from '../GlossaryTermReferencesModal.component';

interface GlossaryTermReferencesProps {
  isVersionView?: boolean;
  glossaryTerm: GlossaryTerm;
  permissions: OperationPermission;
  onGlossaryTermUpdate: (glossaryTerm: GlossaryTerm) => Promise<void>;
}

const GlossaryTermReferences = ({
  glossaryTerm,
  permissions,
  onGlossaryTermUpdate,
  isVersionView,
}: GlossaryTermReferencesProps) => {
  const [references, setReferences] = useState<TermReference[]>([]);
  const [isViewMode, setIsViewMode] = useState<boolean>(true);

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

  const getReferenceElement = useCallback(
    (ref: TermReference, versionStatus?: VersionStatus) => {
      let iconColor: string;
      let textClassName: string;
      if (versionStatus?.added) {
        iconColor = SUCCESS_COLOR;
        textClassName = 'text-success';
      } else if (versionStatus?.removed) {
        iconColor = TEXT_GREY_MUTED;
        textClassName = 'text-grey-muted';
      } else {
        iconColor = TEXT_BODY_COLOR;
        textClassName = 'text-body';
      }

      return (
        <Tag
          className={classNames(
            'm-r-xs m-t-xs d-flex items-center term-reference-tag bg-white',
            { 'diff-added': versionStatus?.added },
            { 'diff-removed ': versionStatus?.removed }
          )}
          key={ref.name}>
          <Tooltip placement="bottomLeft" title={ref.name}>
            <a
              data-testid={`reference-link-${ref.name}`}
              href={ref?.endpoint}
              rel="noopener noreferrer"
              target="_blank">
              <div className="d-flex items-center">
                <ExternalLinkIcon
                  className="m-r-xss"
                  color={iconColor}
                  width="12px"
                />
                <span className={textClassName}>{ref.name}</span>
              </div>
            </a>
          </Tooltip>
        </Tag>
      );
    },
    []
  );

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
        {unchangedReferences.map((reference) => getReferenceElement(reference))}
        {addedReferences.map((reference) =>
          getReferenceElement(reference, { added: true })
        )}
        {deletedReferences.map((reference) =>
          getReferenceElement(reference, { removed: true })
        )}
      </div>
    );
  }, [glossaryTerm]);

  return (
    <div data-testid="references-container">
      <div className="w-full">
        <Space
          className="w-full"
          data-testid={`section-${t('label.reference-plural')}`}>
          <div className="flex-center">
            <Typography.Text className="right-panel-label">
              {t('label.reference-plural')}
            </Typography.Text>
            {references.length > 0 && permissions.EditAll && (
              <Tooltip
                title={
                  permissions.EditAll
                    ? t('label.edit-entity', {
                        entity: t('label.reference-plural'),
                      })
                    : NO_PERMISSION_FOR_ACTION
                }>
                <Button
                  className="cursor-pointer flex-center m-l-xss"
                  data-testid="edit-button"
                  disabled={!permissions.EditAll}
                  icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
                  size="small"
                  type="text"
                  onClick={() => setIsViewMode(false)}
                />
              </Tooltip>
            )}
          </div>
        </Space>
        <>
          {isVersionView ? (
            getVersionReferenceElements()
          ) : (
            <div className="d-flex flex-wrap">
              {references.map((ref) => getReferenceElement(ref))}
              {permissions.EditAll && references.length === 0 && (
                <TagButton
                  className="text-primary cursor-pointer"
                  dataTestId="term-references-add-button"
                  icon={<PlusIcon height={16} name="plus" width={16} />}
                  label={t('label.add')}
                  tooltip=""
                  onClick={() => {
                    setIsViewMode(false);
                  }}
                />
              )}
              {!permissions.EditAll && references.length === 0 && (
                <div>{NO_DATA_PLACEHOLDER}</div>
              )}
            </div>
          )}
        </>
      </div>

      <GlossaryTermReferencesModal
        isVisible={!isViewMode}
        references={references || []}
        onClose={() => {
          setIsViewMode(true);
        }}
        onSave={handleReferencesSave}
      />
    </div>
  );
};

export default GlossaryTermReferences;
