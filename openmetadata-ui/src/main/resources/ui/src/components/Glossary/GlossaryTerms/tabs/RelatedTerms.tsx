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

import { Typography } from 'antd';
import { DefaultOptionType } from 'antd/lib/select';

import { isArray, isEmpty, isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import IconTerm from '../../../../assets/svg/book.svg?react';
import TagSelectForm from '../../../../components/Tag/TagsSelectForm/TagsSelectForm.component';
import { NO_DATA_PLACEHOLDER } from '../../../../constants/constants';
import { EntityField } from '../../../../constants/Feeds.constants';
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
import ExpandableCard from '../../../common/ExpandableCard/ExpandableCard';
import {
  EditIconButton,
  PlusIconButton,
} from '../../../common/IconButtons/EditIconButton';
import TagButton from '../../../common/TagButton/TagButton.component';
import { useGenericContext } from '../../../Customization/GenericProvider/GenericProvider';

const RelatedTerms = () => {
  const navigate = useNavigate();
  const {
    data: glossaryTerm,
    onUpdate,
    isVersionView,
    permissions,
  } = useGenericContext<GlossaryTerm>();
  const { t } = useTranslation();
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
    navigate(getGlossaryPath(fqn));
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
      label: getEntityName(value),
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
          handleRelatedTermClick(entity.fullyQualifiedName ?? '');
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
      ) : !permissions.EditAll || !isEmpty(selectedOption) ? (
        <div className="d-flex flex-wrap">
          {selectedOption.map((entity: EntityReference) =>
            getRelatedTermElement(entity)
          )}

          {!permissions.EditAll && selectedOption.length === 0 && (
            <div>{NO_DATA_PLACEHOLDER}</div>
          )}
        </div>
      ) : null,
    [
      permissions,
      selectedOption,
      isVersionView,
      getVersionRelatedTerms,
      getRelatedTermElement,
    ]
  );

  const header = (
    <div className="d-flex items-center gap-2">
      <Typography.Text className="text-sm font-medium">
        {t('label.related-term-plural')}
      </Typography.Text>
      {permissions.EditAll &&
        (isEmpty(selectedOption) ? (
          <PlusIconButton
            data-testid="related-term-add-button"
            size="small"
            title={t('label.add-entity', {
              entity: t('label.related-term-plural'),
            })}
            onClick={() => {
              setIsIconVisible(false);
            }}
          />
        ) : (
          <EditIconButton
            newLook
            data-testid="edit-button"
            size="small"
            title={t('label.edit-entity', {
              entity: t('label.related-term-plural'),
            })}
            onClick={() => setIsIconVisible(false)}
          />
        ))}
    </div>
  );

  return (
    <ExpandableCard
      cardProps={{
        title: header,
      }}
      dataTestId="related-term-container"
      isExpandDisabled={selectedOption.length === 0}>
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
    </ExpandableCard>
  );
};

export default RelatedTerms;
