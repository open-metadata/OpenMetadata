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
import { Button, Space, Typography } from 'antd';
import { cloneDeep, isEmpty, isEqual } from 'lodash';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NO_DATA_PLACEHOLDER } from '../../../../constants/constants';
import { EntityField } from '../../../../constants/Feeds.constants';
import { GlossaryTerm } from '../../../../generated/entity/data/glossaryTerm';
import { ChangeDescription } from '../../../../generated/entity/type';
import {
    getChangedEntityNewValue,
    getChangedEntityOldValue,
    getDiffByFieldName
} from '../../../../utils/EntityVersionUtils';
import { Select } from '../../../common/AntdCompat';
import ExpandableCard from '../../../common/ExpandableCard/ExpandableCard';
import {
    EditIconButton,
    PlusIconButton
} from '../../../common/IconButtons/EditIconButton';
import TagButton from '../../../common/TagButton/TagButton.component';
import { useGenericContext } from '../../../Customization/GenericProvider/GenericProvider';
;

const GlossaryTermSynonyms = () => {
  const [isViewMode, setIsViewMode] = useState<boolean>(true);
  const [synonyms, setSynonyms] = useState<string[]>([]);
  const [saving, setSaving] = useState<boolean>(false);
  const {
    data: glossaryTerm,
    onUpdate: onGlossaryTermUpdate,
    isVersionView,
    permissions,
  } = useGenericContext<GlossaryTerm>();
  const { t } = useTranslation();

  const getSynonyms = () =>
    !permissions.EditAll || !isEmpty(synonyms) ? (
      <div className="d-flex flex-wrap">
        {synonyms.map((synonym) => (
          <TagButton
            className="glossary-synonym-tag"
            key={synonym}
            label={synonym}
          />
        ))}

        {!permissions.EditAll && synonyms.length === 0 && (
          <div>{NO_DATA_PLACEHOLDER}</div>
        )}
      </div>
    ) : null;

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

  const header = (
    <div className="d-flex items-center gap-2">
      <Typography.Text className="text-sm font-medium">
        {t('label.synonym-plural')}
      </Typography.Text>
      {permissions.EditAll &&
        isViewMode &&
        (isEmpty(synonyms) ? (
          <PlusIconButton
            data-testid="synonym-add-button"
            size="small"
            title={t('label.add-entity', {
              entity: t('label.synonym-plural'),
            })}
            onClick={() => {
              setIsViewMode(false);
            }}
          />
        ) : (
          <EditIconButton
            newLook
            data-testid="edit-button"
            size="small"
            title={t('label.edit-entity', {
              entity: t('label.synonym-plural'),
            })}
            onClick={() => setIsViewMode(false)}
          />
        ))}
    </div>
  );

  return (
    <ExpandableCard
      cardProps={{
        title: header,
      }}
      dataTestId="synonyms-container"
      isExpandDisabled={isEmpty(synonyms)}>
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
    </ExpandableCard>
  );
};

export default GlossaryTermSynonyms;
