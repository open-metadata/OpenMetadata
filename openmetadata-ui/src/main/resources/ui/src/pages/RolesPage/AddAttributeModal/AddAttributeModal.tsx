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

import { Grid, Input, SimpleModal } from '@openmetadata/ui-core-components';
import { Check, Search } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import NoSearchResultsPlaceholder from '../../../components/common/EmptyPlaceholder/NoSearchResultsPlaceholder';
import Loader from '../../../components/common/Loader/Loader';
import RichTextEditorPreviewerV1 from '../../../components/common/RichTextEditor/RichTextEditorPreviewerV1';
import { EntityType } from '../../../enums/entity.enum';
import { Policy } from '../../../generated/entity/policies/policy';
import { Role } from '../../../generated/entity/teams/role';
import { EntityReference } from '../../../generated/type/entityReference';
import { getPolicies, getRoles } from '../../../rest/rolesAPIV1';
import { getLayoutGutter } from '../../../utils/common/layout.utils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import {
  highlightSearchText,
  renderHighlightedText,
} from '../../../utils/EntitySearchUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

interface Props {
  type: EntityType;
  selectedKeys: string[];
  title: string;
  isOpen: boolean;
  onSave: (values: string[]) => void;
  onCancel: () => void;
  isModalLoading: boolean;
}

const AddAttributeModal: FC<Props> = ({
  isOpen,
  onSave,
  onCancel,
  title,
  type,
  selectedKeys,
  isModalLoading,
}) => {
  const { t } = useTranslation();
  const [data, setData] = useState<EntityReference[]>([]);
  const [searchedData, setSearchedData] = useState<EntityReference[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedValues, setSelectedValues] = useState<string[]>(selectedKeys);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const fetchPolicies = async () => {
    setIsLoading(true);
    try {
      let datalist: {
        data: Policy[] | Role[];
      } = {
        data: [],
      };

      switch (type) {
        case EntityType.POLICY:
          datalist = await getPolicies('', undefined, undefined, 100);

          break;
        case EntityType.ROLE:
          datalist = await getRoles('', undefined, undefined, false, 100);

          break;

        default:
          break;
      }

      const entityReferenceData: EntityReference[] = (datalist.data || []).map(
        (record) => ({
          id: record.id,
          name: record.name,
          displayName: record.displayName,
          type,
          description: record.description,
        })
      );

      setData(entityReferenceData);
      setSearchedData(entityReferenceData);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleValueSelect = (id: string) => {
    const isAdded = selectedValues.includes(id);
    if (isAdded) {
      setSelectedValues((prev) => prev.filter((v) => v !== id));
    } else {
      setSelectedValues((prev) => [...prev, id]);
    }
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    if (value) {
      setSearchedData(
        data.filter(
          (pData) =>
            pData.name?.includes(value) ||
            pData.displayName?.includes(value) ||
            pData.description?.includes(value)
        )
      );
    } else {
      setSearchedData(data);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  return (
    <SimpleModal
      data-testid="modal-container"
      isDismissable={false}
      isOkLoading={isModalLoading}
      isOpen={isOpen}
      okText={t('label.save')}
      title={`${title} (${selectedValues.length}/${data.length} selected)`}
      width={750}
      onCancel={onCancel}
      onOk={() => onSave(selectedValues)}>
      {isLoading ? (
        <Loader />
      ) : (
        <>
          <Input
            aria-label={t('label.search-entity', {
              entity: type,
            })}
            icon={Search}
            inputDataTestId="search-input"
            placeholder={t('label.search-entity', {
              entity: type,
            })}
            onChange={handleSearch}
          />
          {isEmpty(searchedData) ? (
            <div className="tw:relative tw:h-full tw:w-full tw:min-h-60 tw:rounded-xl tw:bg-surface">
              <NoSearchResultsPlaceholder data-testid="search-error-placeholder" />
            </div>
          ) : (
            <div>
              {searchedData.map((option) => (
                <Grid
                  className={classNames(
                    'layout-row layout-grid tw:cursor-pointer tw:p-4',
                    {
                      'tw:bg-utility-brand-50': selectedValues.includes(
                        option.id
                      ),
                    }
                  )}
                  data-testid="policy-row"
                  key={option.id}
                  style={{ ...getLayoutGutter(16, 16) }}
                  onClick={() => handleValueSelect(option.id)}>
                  <Grid.Item className="layout-column" span={6}>
                    {renderHighlightedText(
                      highlightSearchText(getEntityName(option), searchTerm)
                    )}
                  </Grid.Item>
                  <Grid.Item className="layout-column" span={16}>
                    <RichTextEditorPreviewerV1
                      markdown={highlightSearchText(
                        option.description ?? '',
                        searchTerm
                      )}
                    />
                  </Grid.Item>
                  <Grid.Item className="layout-column" span={2}>
                    {selectedValues.includes(option.id) && (
                      <Check
                        className="tw:shrink-0 tw:text-brand-secondary"
                        data-testid="selected-check-icon"
                      />
                    )}
                  </Grid.Item>
                </Grid>
              ))}
            </div>
          )}
        </>
      )}
    </SimpleModal>
  );
};

export default AddAttributeModal;
