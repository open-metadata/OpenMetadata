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
import { Button, Select, Space } from 'antd';
import TagButton from 'components/TagButton/TagButton.component';
import { t } from 'i18next';
import { cloneDeep, isEmpty, isEqual } from 'lodash';
import React, { useEffect, useState } from 'react';
import { ReactComponent as PlusIcon } from '../../../assets/svg/plus-primary.svg';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { OperationPermission } from '../../PermissionProvider/PermissionProvider.interface';

interface GlossaryTermSynonymsProps {
  permissions: OperationPermission;
  glossaryTerm: GlossaryTerm;
  onGlossaryTermUpdate: (glossaryTerm: GlossaryTerm) => void;
}

const GlossaryTermSynonyms = ({
  permissions,
  glossaryTerm,
  onGlossaryTermUpdate,
}: GlossaryTermSynonymsProps) => {
  const [isViewMode, setIsViewMode] = useState<boolean>(true);
  const [synonyms, setSynonyms] = useState<string[]>([]);

  const removeSynonym = (removedTag: string) => {
    const newSynonyms = synonyms.filter((synonym) => synonym !== removedTag);
    setSynonyms(newSynonyms);
    handleSynonymsSave(newSynonyms);
  };

  const getSynonyms = () => (
    <div className="d-flex flex-wrap">
      {permissions.EditAll && (
        <TagButton
          className="tw-text-primary"
          icon={<PlusIcon height={16} name="plus" width={16} />}
          label={t('label.synonym-plural')}
          onClick={() => {
            setIsViewMode(false);
          }}
        />
      )}
      {synonyms.map((synonym, index) => (
        <TagButton
          className="glossary-synonym-tag"
          isRemovable={permissions.EditAll}
          key={index}
          label={synonym}
          removeTag={(_e, removedTag: string) => {
            removeSynonym(removedTag);
          }}
        />
      ))}
    </div>
  );

  const handleSynonymsSave = (newSynonyms: string[]) => {
    if (!isEqual(newSynonyms, glossaryTerm.synonyms)) {
      let updatedGlossaryTerm = cloneDeep(glossaryTerm);
      updatedGlossaryTerm = {
        ...updatedGlossaryTerm,
        synonyms: newSynonyms,
      };

      onGlossaryTermUpdate(updatedGlossaryTerm);
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
    <div className="flex" data-testid="synonyms-container">
      {isViewMode ? (
        getSynonyms()
      ) : (
        <Space align="center" className="w-full" size={8}>
          <Select
            className="w-min-15"
            id="synonyms-select"
            mode="tags"
            placeholder={t('label.add-entity', {
              entity: t('label.synonym-plural'),
            })}
            style={{ width: '100%' }}
            value={synonyms}
            onChange={(value) => setSynonyms(value)}
          />
          <>
            <Button
              className="w-6 p-x-05"
              data-testid="cancelAssociatedTag"
              icon={<CloseOutlined size={12} />}
              size="small"
              onClick={() => setIsViewMode(true)}
            />
            <Button
              className="w-6 p-x-05"
              data-testid="saveAssociatedTag"
              icon={<CheckOutlined size={12} />}
              size="small"
              type="primary"
              onClick={() => handleSynonymsSave(synonyms)}
            />
          </>
        </Space>
      )}
    </div>
  );
};

export default GlossaryTermSynonyms;
