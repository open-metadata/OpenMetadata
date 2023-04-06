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
import { ReactComponent as EditIcon } from 'assets/svg/edit-new.svg';
import { ReactComponent as ExternalLinkIcon } from 'assets/svg/external-links.svg';
import { ReactComponent as PlusIcon } from 'assets/svg/plus-primary.svg';
import TagButton from 'components/TagButton/TagButton.component';
import { DE_ACTIVE_COLOR, TEXT_BODY_COLOR } from 'constants/constants';
import { NO_PERMISSION_FOR_ACTION } from 'constants/HelperTextUtil';
import { t } from 'i18next';
import { cloneDeep, isEqual } from 'lodash';
import React, { useEffect, useState } from 'react';
import {
  GlossaryTerm,
  TermReference,
} from '../../../generated/entity/data/glossaryTerm';
import { OperationPermission } from '../../PermissionProvider/PermissionProvider.interface';
import GlossaryTermReferencesModal from '../GlossaryTermReferencesModal.component';

interface GlossaryTermReferences {
  glossaryTerm: GlossaryTerm;
  permissions: OperationPermission;
  onGlossaryTermUpdate: (glossaryTerm: GlossaryTerm) => void;
}

const GlossaryTermReferences = ({
  glossaryTerm,
  permissions,
  onGlossaryTermUpdate,
}: GlossaryTermReferences) => {
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

        onGlossaryTermUpdate(updatedGlossaryTerm);
        if (updateState) {
          setReferences(updatedRef);
        }
      }
      setIsViewMode(true);
    } catch (error) {
      // Added catch block to prevent uncaught promise
    }
  };

  const onReferenceModalSave = (values: TermReference[]) => {
    handleReferencesSave(values);
  };

  useEffect(() => {
    setReferences(glossaryTerm.references ? glossaryTerm.references : []);
  }, [glossaryTerm.references]);

  return (
    <div data-testid="references-container">
      <Space className="w-full" direction="vertical">
        <Space
          className="w-full"
          data-testid={`section-${t('label.reference-plural')}`}>
          <div className="flex-center">
            <Typography.Text className="glossary-subheading">
              {t('label.reference-plural')}
            </Typography.Text>
            {references.length > 0 && permissions.EditAll && (
              <Tooltip
                title={
                  permissions.EditAll
                    ? t('label.edit')
                    : NO_PERMISSION_FOR_ACTION
                }>
                <Button
                  className="cursor-pointer m--t-xss m-l-xss"
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
          <div className="d-flex flex-wrap">
            {references.map((ref) => (
              <Tag className="term-reference-tag tw-bg-white" key={ref.name}>
                <a
                  className=""
                  data-testid="owner-link"
                  href={ref?.endpoint}
                  rel="noopener noreferrer"
                  target="_blank">
                  <Space align="center" size={4}>
                    <ExternalLinkIcon color={TEXT_BODY_COLOR} width="12px" />
                    <Typography.Text>{ref?.name}</Typography.Text>
                  </Space>
                </a>
              </Tag>
            ))}
            {permissions.EditAll && references.length === 0 && (
              <TagButton
                className="tw-text-primary"
                icon={<PlusIcon height={16} name="plus" width={16} />}
                label={t('label.add')}
                onClick={() => {
                  setIsViewMode(false);
                }}
              />
            )}
          </div>
        </>
      </Space>

      <GlossaryTermReferencesModal
        isVisible={!isViewMode}
        references={references || []}
        onClose={() => {
          setIsViewMode(true);
        }}
        onSave={(values: TermReference[]) => {
          onReferenceModalSave(values);
        }}
      />
    </div>
  );
};

export default GlossaryTermReferences;
