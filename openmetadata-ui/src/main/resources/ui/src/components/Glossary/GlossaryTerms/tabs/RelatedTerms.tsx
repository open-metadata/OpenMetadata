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

import { Button, Tooltip, Typography } from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import { t } from 'i18next';
import { isArray, isEmpty, isUndefined } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { ReactComponent as IconTerm } from '../../../../assets/svg/book.svg';
import { ReactComponent as EditIcon } from '../../../../assets/svg/edit-new.svg';
import { ReactComponent as PlusIcon } from '../../../../assets/svg/plus-primary.svg';
import TagSelectForm from '../../../../components/Tag/TagsSelectForm/TagsSelectForm.component';
import {
  DE_ACTIVE_COLOR,
  NO_DATA_PLACEHOLDER,
} from '../../../../constants/constants';
import { EntityField } from '../../../../constants/Feeds.constants';
import { NO_PERMISSION_FOR_ACTION } from '../../../../constants/HelperTextUtil';
import { EntityType } from '../../../../enums/entity.enum';
import { GlossaryTerm } from '../../../../generated/entity/data/glossaryTerm';
import {
  ChangeDescription,
  EntityReference,
} from '../../../../generated/entity/type';
import {
  getEntityName,
  getEntityReferenceFromEntity,
} from '../../../../utils/EntityUtils';
import {
  getChangedEntityNewValue,
  getChangedEntityOldValue,
  getDiffByFieldName,
} from '../../../../utils/EntityVersionUtils';
import { VersionStatus } from '../../../../utils/EntityVersionUtils.interface';
import { getGlossaryPath } from '../../../../utils/RouterUtils';
import { SelectOption } from '../../../common/AsyncSelectList/AsyncSelectList.interface';
import TagButton from '../../../common/TagButton/TagButton.component';
import { useGenericContext } from '../../../GenericProvider/GenericProvider';

const RelatedTerms = () => {
  const history = useHistory();
  const {
    data: glossaryTerm,
    onUpdate,
    isVersionView,
    permissions,
  } = useGenericContext<GlossaryTerm>();

  const [isIconVisible, setIsIconVisible] = useState<boolean>(true);
  const [selectedOption, setSelectedOption] = useState<EntityReference[]>([]);

  const initialOptions = useMemo(() => {
    return (
      selectedOption.map((item) => {
        return {
          label: getEntityName(item),
          value: item.fullyQualifiedName,
          data: item,
        };
      }) ?? []
    );
  }, [selectedOption]);

  const handleRelatedTermClick = (fqn: string) => {
    history.push(getGlossaryPath(fqn));
  };

  const handleRelatedTermsSave = async (
    selectedData: DefaultOptionType | DefaultOptionType[]
  ): Promise<void> => {
    if (!isArray(selectedData)) {
      return;
    }

    const newOptions = selectedData.map((value) =>
      getEntityReferenceFromEntity(
        isUndefined(value.data)
          ? glossaryTerm.relatedTerms?.find(
              (term) => term.fullyQualifiedName === value.value
            )
          : value.data,
        EntityType.GLOSSARY_TERM
      )
    );

    const updatedGlossaryTerm = {
      ...glossaryTerm,
      relatedTerms: newOptions,
    };

    await onUpdate(updatedGlossaryTerm);
    setIsIconVisible(true);
  };

  const formatOptions = (data: EntityReference[]) => {
    return data.map((value) => ({
      ...value,
      value: value.id,
      label: value.displayName || value.name,
      key: value.id,
    }));
  };

  const handleCancel = () => {
    setIsIconVisible(true);
  };

  useEffect(() => {
    if (glossaryTerm) {
      setSelectedOption(formatOptions(glossaryTerm.relatedTerms ?? []));
    }
  }, [glossaryTerm]);

  const getRelatedTermElement = useCallback(
    (entity: EntityReference, versionStatus?: VersionStatus) => (
      <TagButton
        className="cursor-pointer"
        icon={<IconTerm height={12} name="folder" />}
        key={entity.fullyQualifiedName}
        label={getEntityName(entity)}
        tooltip={
          <div className="p-xss">
            <strong>{entity.fullyQualifiedName}</strong>
            <div>{entity.description}</div>
          </div>
        }
        versionData={versionStatus}
        onClick={() => {
          handleRelatedTermClick(entity.fullyQualifiedName || '');
        }}
      />
    ),
    []
  );

  const getVersionRelatedTerms = useCallback(() => {
    const changeDescription = glossaryTerm.changeDescription;
    const relatedTermsDiff = getDiffByFieldName(
      EntityField.RELATEDTERMS,
      changeDescription as ChangeDescription
    );

    const addedRelatedTerms: EntityReference[] = JSON.parse(
      getChangedEntityNewValue(relatedTermsDiff) ?? '[]'
    );
    const deletedRelatedTerms: EntityReference[] = JSON.parse(
      getChangedEntityOldValue(relatedTermsDiff) ?? '[]'
    );

    const unchangedRelatedTerms = glossaryTerm.relatedTerms
      ? glossaryTerm.relatedTerms.filter(
          (relatedTerm) =>
            !addedRelatedTerms.find(
              (addedRelatedTerm: EntityReference) =>
                addedRelatedTerm.id === relatedTerm.id
            )
        )
      : [];

    const noSynonyms =
      isEmpty(unchangedRelatedTerms) &&
      isEmpty(addedRelatedTerms) &&
      isEmpty(deletedRelatedTerms);

    if (noSynonyms) {
      return <div>{NO_DATA_PLACEHOLDER}</div>;
    }

    return (
      <div className="d-flex flex-wrap">
        {unchangedRelatedTerms.map((relatedTerm) =>
          getRelatedTermElement(relatedTerm)
        )}
        {addedRelatedTerms.map((relatedTerm) =>
          getRelatedTermElement(relatedTerm, { added: true })
        )}
        {deletedRelatedTerms.map((relatedTerm) =>
          getRelatedTermElement(relatedTerm, { removed: true })
        )}
      </div>
    );
  }, [glossaryTerm]);

  const relatedTermsContainer = useMemo(
    () =>
      isVersionView ? (
        getVersionRelatedTerms()
      ) : (
        <div className="d-flex flex-wrap">
          {permissions.EditAll && selectedOption.length === 0 && (
            <TagButton
              className="text-primary cursor-pointer"
              dataTestId="related-term-add-button"
              icon={<PlusIcon height={16} name="plus" width={16} />}
              label={t('label.add')}
              tooltip=""
              onClick={() => {
                setIsIconVisible(false);
              }}
            />
          )}

          {selectedOption.map((entity: EntityReference) =>
            getRelatedTermElement(entity)
          )}

          {!permissions.EditAll && selectedOption.length === 0 && (
            <div>{NO_DATA_PLACEHOLDER}</div>
          )}
        </div>
      ),
    [
      permissions,
      selectedOption,
      isVersionView,
      getVersionRelatedTerms,
      getRelatedTermElement,
    ]
  );

  return (
    <div className="flex flex-col" data-testid="related-term-container">
      <div className="d-flex items-center">
        <Typography.Text className="right-panel-label">
          {t('label.related-term-plural')}
        </Typography.Text>
        {permissions.EditAll && selectedOption.length > 0 && (
          <Tooltip
            title={
              permissions.EditAll
                ? t('label.edit-entity', {
                    entity: t('label.related-term-plural'),
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
              onClick={() => setIsIconVisible(false)}
            />
          </Tooltip>
        )}
      </div>

      {isIconVisible ? (
        relatedTermsContainer
      ) : (
        <TagSelectForm
          defaultValue={selectedOption.map(
            (item) => item.fullyQualifiedName ?? ''
          )}
          filterOptions={[glossaryTerm?.fullyQualifiedName ?? '']}
          placeholder={t('label.add-entity', {
            entity: t('label.related-term-plural'),
          })}
          tagData={initialOptions as SelectOption[]}
          onCancel={handleCancel}
          onSubmit={handleRelatedTermsSave}
        />
      )}
    </div>
  );
};

export default RelatedTerms;
