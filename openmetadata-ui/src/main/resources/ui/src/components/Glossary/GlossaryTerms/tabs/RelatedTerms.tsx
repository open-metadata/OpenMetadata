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
import { cloneDeep, includes, isArray, isEmpty, uniqWith } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { ReactComponent as IconTerm } from '../../../../assets/svg/book.svg';
import { ReactComponent as EditIcon } from '../../../../assets/svg/edit-new.svg';
import { ReactComponent as PlusIcon } from '../../../../assets/svg/plus-primary.svg';
import TagSelectForm from '../../../../components/Tag/TagsSelectForm/TagsSelectForm.component';
import {
  DE_ACTIVE_COLOR,
  NO_DATA_PLACEHOLDER,
  PAGE_SIZE,
} from '../../../../constants/constants';
import { EntityField } from '../../../../constants/Feeds.constants';
import { NO_PERMISSION_FOR_ACTION } from '../../../../constants/HelperTextUtil';
import { OperationPermission } from '../../../../context/PermissionProvider/PermissionProvider.interface';
import { SearchIndex } from '../../../../enums/search.enum';
import { GlossaryTerm } from '../../../../generated/entity/data/glossaryTerm';
import {
  ChangeDescription,
  EntityReference,
} from '../../../../generated/entity/type';
import { Paging } from '../../../../generated/type/paging';
import { searchData } from '../../../../rest/miscAPI';
import { formatSearchGlossaryTermResponse } from '../../../../utils/APIUtils';
import { getEntityName } from '../../../../utils/EntityUtils';
import {
  getChangedEntityNewValue,
  getChangedEntityOldValue,
  getDiffByFieldName,
} from '../../../../utils/EntityVersionUtils';
import { VersionStatus } from '../../../../utils/EntityVersionUtils.interface';
import { getEntityReferenceFromGlossary } from '../../../../utils/GlossaryUtils';
import { getGlossaryPath } from '../../../../utils/RouterUtils';
import TagButton from '../../../common/TagButton/TagButton.component';

interface RelatedTermsProps {
  isVersionView?: boolean;
  permissions: OperationPermission;
  glossaryTerm: GlossaryTerm;
  onGlossaryTermUpdate: (data: GlossaryTerm) => Promise<void>;
}

const RelatedTerms = ({
  isVersionView,
  glossaryTerm,
  permissions,
  onGlossaryTermUpdate,
}: RelatedTermsProps) => {
  const history = useHistory();
  const [isIconVisible, setIsIconVisible] = useState<boolean>(true);
  const [options, setOptions] = useState<EntityReference[]>([]);
  const [selectedOption, setSelectedOption] = useState<EntityReference[]>([]);

  const handleRelatedTermClick = (fqn: string) => {
    history.push(getGlossaryPath(fqn));
  };

  const handleRelatedTermsSave = async (
    selectedData: DefaultOptionType | DefaultOptionType[]
  ): Promise<void> => {
    if (!isArray(selectedData)) {
      return;
    }

    const newOptions = uniqWith(
      options,
      (arrVal, othVal) => arrVal.id === othVal.id
    ).filter((item) =>
      selectedData.find((data) => data.value === item.fullyQualifiedName)
    );

    let updatedGlossaryTerm = cloneDeep(glossaryTerm);
    const oldTerms = newOptions.filter((d) =>
      includes(glossaryTerm.relatedTerms, d)
    );
    const newTerms = newOptions
      .filter((d) => !includes(glossaryTerm.relatedTerms, d))
      .map((d) => ({
        id: d.id,
        type: d.type,
        displayName: d.displayName,
        name: d.name,
      }));
    updatedGlossaryTerm = {
      ...updatedGlossaryTerm,
      relatedTerms: [...oldTerms, ...newTerms],
    };

    await onGlossaryTermUpdate(updatedGlossaryTerm);
    setIsIconVisible(true);
  };

  const fetchGlossaryTerms = async (
    searchText = '',
    page: number
  ): Promise<{
    data: {
      label: string;
      value: string;
    }[];
    paging: Paging;
  }> => {
    const res = await searchData(
      searchText,
      page,
      PAGE_SIZE,
      '',
      '',
      '',
      SearchIndex.GLOSSARY_TERM
    );

    const termResult = formatSearchGlossaryTermResponse(
      res.data.hits.hits
    ).filter(
      (item) => item.fullyQualifiedName !== glossaryTerm.fullyQualifiedName
    );

    const results = termResult.map(getEntityReferenceFromGlossary);
    setOptions((prev) => [...prev, ...results]);

    return {
      data: results.map((item) => ({
        label: item.fullyQualifiedName ?? '',
        value: item.fullyQualifiedName ?? '',
      })),
      paging: {
        total: res.data.hits.total.value,
      },
    };
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
      setOptions(glossaryTerm.relatedTerms ?? []);
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
          fetchApi={fetchGlossaryTerms}
          placeholder={t('label.add-entity', {
            entity: t('label.related-term-plural'),
          })}
          onCancel={handleCancel}
          onSubmit={handleRelatedTermsSave}
        />
      )}
    </div>
  );
};

export default RelatedTerms;
