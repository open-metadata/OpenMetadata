/*
 *  Copyright 2023 Collate.
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

import { Button, Col, Row, Table, Tag, Tooltip } from 'antd';
import { ColumnsType, ExpandableConfig } from 'antd/lib/table/interface';
import { AxiosError } from 'axios';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import Searchbar from 'components/common/searchbar/Searchbar';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from 'components/PermissionProvider/PermissionProvider.interface';
import { FQN_SEPARATOR_CHAR } from 'constants/char.constants';
import { API_RES_MAX_SIZE } from 'constants/constants';
import { NO_PERMISSION_FOR_ACTION } from 'constants/HelperTextUtil';
import { TagLabel } from 'generated/entity/data/glossaryTerm';
import { Operation } from 'generated/entity/policies/policy';
import { isEmpty } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory, useParams } from 'react-router-dom';
import { getGlossaryTerms, ListGlossaryTermsParams } from 'rest/glossaryAPI';
import { getEntityName } from 'utils/CommonUtils';
import {
  createGlossaryTermTree,
  getRootLevelGlossaryTerm,
  getSearchedDataFromGlossaryTree,
} from 'utils/GlossaryUtils';
import { checkPermission } from 'utils/PermissionsUtils';
import {
  getAddGlossaryTermsPath,
  getGlossaryPath,
  getTagPath,
} from 'utils/RouterUtils';
import { getTableExpandableConfig } from 'utils/TableUtils';
import { showErrorToast } from 'utils/ToastUtils';
import {
  GlossaryTermTabProps,
  ModifiedGlossaryTerm,
} from './GlossaryTermTab.interface';

const GlossaryTermTab = ({
  glossaryId,
  glossaryTermId,
  selectedGlossaryFqn,
}: GlossaryTermTabProps) => {
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  const history = useHistory();

  const { glossaryName } = useParams<{ glossaryName: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [glossaryTerms, setGlossaryTerms] = useState<ModifiedGlossaryTerm[]>(
    []
  );
  const [filterData, setFilterData] = useState<ModifiedGlossaryTerm[]>([]);

  const createGlossaryTermPermission = useMemo(
    () =>
      checkPermission(
        Operation.Create,
        ResourceEntity.GLOSSARY_TERM,
        permissions
      ),
    [permissions]
  );

  const columns = useMemo(() => {
    const data: ColumnsType<ModifiedGlossaryTerm> = [
      {
        title: 'Terms',
        dataIndex: 'name',
        key: 'name',
        width: 250,
        render: (_, record) => (
          <Link
            className="hover:tw-underline tw-cursor-pointer"
            to={getGlossaryPath(record.fullyQualifiedName || record.name)}>
            {getEntityName(record)}
          </Link>
        ),
      },
      {
        title: 'Description',
        dataIndex: 'description',
        key: 'description',
        render: (description: string) =>
          description.trim() ? (
            <RichTextEditorPreviewer
              enableSeeMoreVariant
              markdown={description}
              maxLength={500}
            />
          ) : (
            <span className="tw-no-description">
              {t('label.no-description')}
            </span>
          ),
      },
      {
        title: 'Tags',
        dataIndex: 'tags',
        key: 'tags',
        width: 250,
        render: (tags: TagLabel[]) =>
          tags?.length
            ? tags.map((tag) => (
                <Tooltip
                  className="cursor-pointer"
                  key={tag.tagFQN}
                  placement="bottomLeft"
                  title={
                    <div className="text-left p-xss">
                      <div className="m-b-xs">
                        <RichTextEditorPreviewer
                          enableSeeMoreVariant={false}
                          markdown={
                            !isEmpty(tag.description)
                              ? `**${tag.tagFQN}**\n${tag.description}`
                              : t('label.no-entity', {
                                  entity: t('label.description'),
                                })
                          }
                          textVariant="white"
                        />
                      </div>
                    </div>
                  }
                  trigger="hover">
                  <Link
                    to={getTagPath(tag.tagFQN.split(FQN_SEPARATOR_CHAR)[0])}>
                    <Tag>{tag.tagFQN}</Tag>
                  </Link>
                </Tooltip>
              ))
            : '--',
      },
    ];

    return data;
  }, [filterData]);

  const handleAddGlossaryTermClick = () => {
    if (glossaryName) {
      const activeTerm = glossaryName.split(FQN_SEPARATOR_CHAR);
      const glossary = activeTerm[0];
      if (activeTerm.length > 1) {
        history.push(getAddGlossaryTermsPath(glossary, glossaryName));
      } else {
        history.push(getAddGlossaryTermsPath(glossary));
      }
    } else {
      history.push(getAddGlossaryTermsPath(selectedGlossaryFqn ?? ''));
    }
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    if (value) {
      setFilterData(getSearchedDataFromGlossaryTree(glossaryTerms, value));
    } else {
      setFilterData(glossaryTerms);
    }
  };

  const fetchGlossaryTerm = async (
    params?: ListGlossaryTermsParams,
    updateChild = false
  ) => {
    !updateChild && setIsLoading(true);
    try {
      const { data } = await getGlossaryTerms({
        ...params,
        limit: API_RES_MAX_SIZE,
        fields: 'tags,children',
      });

      const updatedData = getRootLevelGlossaryTerm(data, params);

      if (updateChild) {
        const updatedGlossaryTermTree = createGlossaryTermTree(
          glossaryTerms,
          updatedData,
          params?.parent
        );

        // if search term is present, update table only for searched value
        if (searchTerm) {
          setFilterData((pre) =>
            updatedGlossaryTermTree.filter((glossaryTerm) =>
              pre.find((value) => value.id === glossaryTerm.id)
            )
          );
        } else {
          setFilterData(updatedGlossaryTermTree);
        }

        setGlossaryTerms(updatedGlossaryTermTree);
      } else {
        setGlossaryTerms(updatedData as ModifiedGlossaryTerm[]);
        setFilterData(updatedData as ModifiedGlossaryTerm[]);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const expandableConfig: ExpandableConfig<ModifiedGlossaryTerm> = useMemo(
    () => ({
      ...getTableExpandableConfig<ModifiedGlossaryTerm>(),
      onExpand: (isOpen, record) => {
        if (isOpen) {
          fetchGlossaryTerm({ parent: record.id }, true);
        }
      },
    }),
    [fetchGlossaryTerm]
  );

  useEffect(() => {
    fetchGlossaryTerm({ glossary: glossaryId, parent: glossaryTermId });
  }, [glossaryName]);

  if (isLoading) {
    return <Loader />;
  }

  if (glossaryTerms.length === 0) {
    return (
      <ErrorPlaceHolder>
        {t('message.no-entity-data-available', {
          entity: t('label.glossary-term'),
        })}
      </ErrorPlaceHolder>
    );
  }

  return (
    <Row gutter={[0, 16]}>
      <Col span={8}>
        <Searchbar
          removeMargin
          showLoadingStatus
          placeholder={`${t('label.search-for-type', {
            type: t('label.glossary-term'),
          })}...`}
          searchValue={searchTerm}
          typingInterval={500}
          onSearch={handleSearch}
        />
      </Col>
      <Col className="flex justify-end" span={16}>
        <Tooltip
          title={
            createGlossaryTermPermission ? 'Add Term' : NO_PERMISSION_FOR_ACTION
          }>
          <Button
            className="tw-h-8 tw-rounded tw-mr-2"
            data-testid="add-new-tag-button"
            disabled={!createGlossaryTermPermission}
            type="primary"
            onClick={handleAddGlossaryTermClick}>
            Add term
          </Button>
        </Tooltip>
      </Col>
      <Col span={24}>
        {filterData.length > 0 ? (
          <Table
            bordered
            columns={columns}
            dataSource={filterData}
            expandable={expandableConfig}
            pagination={false}
            rowKey="name"
            size="small"
          />
        ) : (
          <ErrorPlaceHolder>
            {t('message.no-entity-found-for-name', {
              entity: t('label.glossary-term'),
              name: searchTerm,
            })}
          </ErrorPlaceHolder>
        )}
      </Col>
    </Row>
  );
};

export default GlossaryTermTab;
