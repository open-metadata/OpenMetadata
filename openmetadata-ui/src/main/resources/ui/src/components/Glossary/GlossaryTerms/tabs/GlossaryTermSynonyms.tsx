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

import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { Button, Select, Space, Tooltip, Typography } from 'antd';
import { t } from 'i18next';
import { cloneDeep, isEmpty, isEqual } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { ReactComponent as EditIcon } from '../../../../assets/svg/edit-new.svg';
import { ReactComponent as PlusIcon } from '../../../../assets/svg/plus-primary.svg';
import {
  DE_ACTIVE_COLOR,
  NO_DATA_PLACEHOLDER,
} from '../../../../constants/constants';
import { EntityField } from '../../../../constants/Feeds.constants';
import { NO_PERMISSION_FOR_ACTION } from '../../../../constants/HelperTextUtil';
import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { GlossaryTerm } from '../../../../generated/entity/data/glossaryTerm';
import { ChangeDescription } from '../../../../generated/entity/type';
import {
  getChangedEntityNewValue,
  getChangedEntityOldValue,
  getDiffByFieldName,
} from '../../../../utils/EntityVersionUtils';
import TagButton from '../../../common/TagButton/TagButton.component';

interface GlossaryTermSynonymsProps {
  isVersionView?: boolean;
  permissions: OperationPermission;
  glossaryTerm: GlossaryTerm;
  onGlossaryTermUpdate: (glossaryTerm: GlossaryTerm) => Promise<void>;
}

const GlossaryTermSynonyms = ({
  permissions,
  glossaryTerm,
  onGlossaryTermUpdate,
  isVersionView,
}: GlossaryTermSynonymsProps) => {
  const [isViewMode, setIsViewMode] = useState<boolean>(true);
  const [synonyms, setSynonyms] = useState<string[]>([]);
  const [saving, setSaving] = useState<boolean>(false);

  const getSynonyms = () => (
    <div className="d-flex flex-wrap">
      {synonyms.map((synonym) => (
        <TagButton
          className="glossary-synonym-tag"
          key={synonym}
          label={synonym}
        />
      ))}
      {permissions.EditAll && synonyms.length === 0 && (
        <TagButton
          className="text-primary cursor-pointer"
          dataTestId="synonym-add-button"
          icon={<PlusIcon height={16} name="plus" width={16} />}
          label={t('label.add')}
          tooltip=""
          onClick={() => {
            setIsViewMode(false);
          }}
        />
      )}
      {!permissions.EditAll && synonyms.length === 0 && (
        <div>{NO_DATA_PLACEHOLDER}</div>
      )}
    </div>
  );

  const getSynonymsContainer = useCallback(() => {
    if (!isVersionView) {
      return getSynonyms();
    }
    const changeDescription = glossaryTerm.changeDescription;
    const synonymsDiff = getDiffByFieldName(
      EntityField.SYNONYMS,
      changeDescription as ChangeDescription
    );

    const addedSynonyms: string[] = JSON.parse(
      getChangedEntityNewValue(synonymsDiff) ?? '[]'
    );
    const deletedSynonyms: string[] = JSON.parse(
      getChangedEntityOldValue(synonymsDiff) ?? '[]'
    );

    const unchangedSynonyms = glossaryTerm.synonyms
      ? glossaryTerm.synonyms.filter(
          (synonym) =>
            !isEmpty(synonym) &&
            !addedSynonyms.find(
              (addedSynonym: string) => addedSynonym === synonym
            )
        )
      : [];

    const noSynonyms =
      isEmpty(unchangedSynonyms) &&
      isEmpty(addedSynonyms) &&
      isEmpty(deletedSynonyms);

    if (noSynonyms) {
      return <div>{NO_DATA_PLACEHOLDER}</div>;
    }

    return (
      <div className="d-flex flex-wrap">
        {unchangedSynonyms.map(
          (synonym) =>
            !isEmpty(synonym) && (
              <TagButton
                className="glossary-synonym-tag"
                key={synonym}
                label={synonym}
              />
            )
        )}
        {addedSynonyms.map(
          (synonym) =>
            !isEmpty(synonym) && (
              <TagButton
                className="glossary-synonym-tag"
                key={synonym}
                label={synonym}
                versionData={{ added: true }}
              />
            )
        )}
        {deletedSynonyms.map(
          (synonym) =>
            !isEmpty(synonym) && (
              <TagButton
                className="glossary-synonym-tag"
                key={synonym}
                label={synonym}
                versionData={{ removed: true }}
              />
            )
        )}
      </div>
    );
  }, [glossaryTerm, isVersionView, getSynonyms]);

  const handleCancel = () => {
    setSynonyms(glossaryTerm.synonyms || []);
    setIsViewMode(true);
  };

  const handleSynonymsSave = async () => {
    if (!isEqual(synonyms, glossaryTerm.synonyms)) {
      let updatedGlossaryTerm = cloneDeep(glossaryTerm);
      updatedGlossaryTerm = {
        ...updatedGlossaryTerm,
        synonyms,
      };
      setSaving(true);
      await onGlossaryTermUpdate(updatedGlossaryTerm);
      setSaving(false);
    }
    setIsViewMode(true);
  };

  useEffect(() => {
    if (glossaryTerm.synonyms?.length) {
      // removing empty string
      setSynonyms(glossaryTerm.synonyms.filter((synonym) => !isEmpty(synonym)));
    }
  }, [glossaryTerm]);

  return (
    <div className="flex flex-col m-r-xs" data-testid="synonyms-container">
      <div className="d-flex items-center">
        <Typography.Text className="right-panel-label">
          {t('label.synonym-plural')}
        </Typography.Text>
        {permissions.EditAll && synonyms.length > 0 && isViewMode && (
          <Tooltip
            placement="top"
            title={
              permissions.EditAll
                ? t('label.edit-entity', {
                    entity: t('label.synonym-plural'),
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

      {isViewMode ? (
        getSynonymsContainer()
      ) : (
        <>
          <Space className="justify-end w-full m-b-xs" size={8}>
            <Button
              className="w-6 p-x-05"
              data-testid="cancel-synonym-btn"
              icon={<CloseOutlined size={12} />}
              size="small"
              onClick={handleCancel}
            />
            <Button
              className="w-6 p-x-05"
              data-testid="save-synonym-btn"
              icon={<CheckOutlined size={12} />}
              loading={saving}
              size="small"
              type="primary"
              onClick={handleSynonymsSave}
            />
          </Space>

          <Select
            className="glossary-select w-full"
            id="synonyms-select"
            mode="tags"
            open={false}
            placeholder={t('label.add-entity', {
              entity: t('label.synonym-plural'),
            })}
            value={synonyms}
            onChange={(value) => setSynonyms(value)}
          />
        </>
      )}
    </div>
  );
};

export default GlossaryTermSynonyms;
