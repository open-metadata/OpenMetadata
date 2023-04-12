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
import { Button, Select, Spin, Tooltip, Typography } from 'antd';
import { ReactComponent as EditIcon } from 'assets/svg/edit-new.svg';
import { ReactComponent as IconFlatDoc } from 'assets/svg/ic-flat-doc.svg';
import TagButton from 'components/TagButton/TagButton.component';
import { NO_PERMISSION_FOR_ACTION } from 'constants/HelperTextUtil';
import { t } from 'i18next';
import { cloneDeep, debounce, includes, toString } from 'lodash';
import React, { useCallback, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { searchData } from 'rest/miscAPI';
import { getGlossaryPath } from 'utils/RouterUtils';
import { ReactComponent as PlusIcon } from '../../../assets/svg/plus-primary.svg';
import { DE_ACTIVE_COLOR, PAGE_SIZE } from '../../../constants/constants';
import { SearchIndex } from '../../../enums/search.enum';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { EntityReference } from '../../../generated/type/entityReference';
import { formatSearchGlossaryTermResponse } from '../../../utils/APIUtils';
import { getEntityReferenceFromGlossary } from '../../../utils/GlossaryUtils';
import { OperationPermission } from '../../PermissionProvider/PermissionProvider.interface';

interface RelatedTermsProps {
  permissions: OperationPermission;
  glossaryTerm: GlossaryTerm;
  onGlossaryTermUpdate: (data: GlossaryTerm) => void;
}

const RelatedTerms = ({
  glossaryTerm,
  permissions,
  onGlossaryTermUpdate,
}: RelatedTermsProps) => {
  const history = useHistory();
  const [isIconVisible, setIsIconVisible] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [options, setOptions] = useState<EntityReference[]>([]);
  const [selectedOption, setSelectedOption] = useState<EntityReference[]>([]);

  const getSearchedTerms = (searchedData: EntityReference[]) => {
    const currOptions = selectedOption.map(
      (item) => item.fullyQualifiedName || item.name
    );
    const data = searchedData.filter((item: EntityReference) => {
      return !currOptions.includes(item.fullyQualifiedName);
    });

    return [...selectedOption, ...data];
  };

  const handleRelatedTermClick = (fqn: string) => {
    history.push(getGlossaryPath(fqn));
  };

  const handleRelatedTermsSave = (newOptions: EntityReference[]) => {
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

    onGlossaryTermUpdate(updatedGlossaryTerm);
    setIsIconVisible(true);
  };

  const suggestionSearch = (searchText = '') => {
    setIsLoading(true);
    searchData(searchText, 1, PAGE_SIZE, '', '', '', SearchIndex.GLOSSARY)
      .then((res) => {
        const termResult = formatSearchGlossaryTermResponse(
          res.data.hits.hits
        ).filter((item) => {
          return item.fullyQualifiedName !== glossaryTerm.fullyQualifiedName;
        });

        const results = termResult.map(getEntityReferenceFromGlossary);

        const data = searchText ? getSearchedTerms(results) : results;
        setOptions(data);
      })
      .catch(() => {
        setOptions(selectedOption);
      })
      .finally(() => setIsLoading(false));
  };

  const debounceOnSearch = useCallback(debounce(suggestionSearch, 250), []);

  const formatOptions = (data: EntityReference[]) => {
    return data.map((value) => ({
      ...value,
      value: value.id,
      label: value.displayName || value.name,
      key: value.id,
    }));
  };

  const handleCancel = () => {
    setSelectedOption(formatOptions(glossaryTerm.relatedTerms || []));
    setIsIconVisible(true);
  };

  useEffect(() => {
    if (glossaryTerm.relatedTerms?.length) {
      setOptions(glossaryTerm.relatedTerms);
      setSelectedOption(formatOptions(glossaryTerm.relatedTerms));
    }
  }, [glossaryTerm]);

  return (
    <div className="flex flex-col gap-3" data-testid="related-term-container">
      <div className="d-flex items-center">
        <Typography.Text className="glossary-subheading">
          {t('label.related-term-plural')}
        </Typography.Text>
        {permissions.EditAll && selectedOption.length > 0 && (
          <Tooltip
            title={
              permissions.EditAll ? t('label.edit') : NO_PERMISSION_FOR_ACTION
            }>
            <Button
              className="cursor-pointer m--t-xss m-l-xss"
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
        <div className="d-flex flex-wrap">
          {permissions.EditAll && selectedOption.length === 0 && (
            <TagButton
              className="tw-text-primary"
              dataTestId="related-term-add-button"
              icon={<PlusIcon height={16} name="plus" width={16} />}
              label={t('label.add')}
              onClick={() => {
                setIsIconVisible(false);
              }}
            />
          )}

          {selectedOption.map((entity: EntityReference) => (
            <TagButton
              icon={<IconFlatDoc height={14} name="folder" width={14} />}
              key={entity.fullyQualifiedName}
              label={toString(entity.displayName)}
              onClick={() => {
                handleRelatedTermClick(entity.fullyQualifiedName || '');
              }}
            />
          ))}
        </div>
      ) : (
        <div className="d-flex items-center gap-2">
          <Select
            className="glossary-select"
            filterOption={false}
            mode="multiple"
            notFoundContent={isLoading ? <Spin size="small" /> : null}
            options={formatOptions(options)}
            placeholder={t('label.add-entity', {
              entity: t('label.related-term-plural'),
            })}
            value={selectedOption}
            onChange={(_, data) => {
              setSelectedOption(data as EntityReference[]);
            }}
            onFocus={() => suggestionSearch()}
            onSearch={debounceOnSearch}
          />
          <>
            <Button
              className="w-6 p-x-05"
              data-testid="cancel-related-term-btn"
              icon={<CloseOutlined size={12} />}
              size="small"
              onClick={() => handleCancel()}
            />
            <Button
              className="w-6 p-x-05"
              data-testid="save-related-term-btn"
              icon={<CheckOutlined size={12} />}
              size="small"
              type="primary"
              onClick={() => handleRelatedTermsSave(selectedOption)}
            />
          </>
        </div>
      )}
    </div>
  );
};

export default RelatedTerms;
