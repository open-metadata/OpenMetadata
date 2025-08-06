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

import { DownOutlined } from '@ant-design/icons';
import {
  Button,
  Checkbox,
  Col,
  Dropdown,
  MenuProps,
  Modal,
  Row,
  Space,
  TableProps,
  Tooltip,
} from 'antd';
import { ColumnsType } from 'antd/lib/table/interface';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { cloneDeep, isEmpty, isUndefined } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as IconDown } from '../../../assets/svg/ic-arrow-down.svg';
import { ReactComponent as IconRight } from '../../../assets/svg/ic-arrow-right.svg';
import { ReactComponent as PlusOutlinedIcon } from '../../../assets/svg/plus-outlined.svg';
import { OwnerLabel } from '../../../components/common/OwnerLabel/OwnerLabel.component';
import StatusBadge from '../../../components/common/StatusBadge/StatusBadge.component';
import {
  NO_DATA_PLACEHOLDER,
  PAGE_SIZE_MEDIUM,
} from '../../../constants/constants';
import {
  DEFAULT_VISIBLE_COLUMNS,
  GLOSSARY_TERM_STATUS_OPTIONS,
  GLOSSARY_TERM_TABLE_COLUMNS_KEYS,
  STATIC_VISIBLE_COLUMNS,
} from '../../../constants/Glossary.contant';
import { EntityType, TabSpecificField } from '../../../enums/entity.enum';
import {
  GlossaryTerm,
  Status,
} from '../../../generated/entity/data/glossaryTerm';
import { Thread } from '../../../generated/entity/feed/thread';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  getFirstLevelGlossaryTermsPaginated,
  getGlossaryTermChildrenLazy,
  GlossaryTermWithChildren,
  patchGlossaryTerm,
} from '../../../rest/glossaryAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import {
  glossaryTermTableColumnsWidth,
  StatusClass,
} from '../../../utils/GlossaryUtils';
import { getGlossaryPath } from '../../../utils/RouterUtils';
import { ownerTableObject } from '../../../utils/TableColumn.util';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import Loader from '../../common/Loader/Loader';
import RichTextEditorPreviewerNew from '../../common/RichTextEditor/RichTextEditorPreviewNew';
import Table from '../../common/Table/Table';
import TagButton from '../../common/TagButton/TagButton.component';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import { ModifiedGlossary, useGlossaryStore } from '../useGlossary.store';
import {
  GlossaryTermTabProps,
  ModifiedGlossaryTerm,
} from './GlossaryTermTab.interface';

const VIRTUAL_SCROLL_HEIGHT = 600;
const PAGE_SIZE = 50;

const GlossaryTermTabOptimized = ({
  isGlossary,
  className,
}: GlossaryTermTabProps) => {
  const navigate = useNavigate();
  const { currentUser } = useApplicationStore();
  const { t } = useTranslation();
  const { activeGlossary, onAddGlossaryTerm, onEditGlossaryTerm } =
    useGlossaryStore();
  const { permissions } = useGenericContext<GlossaryTerm>();

  const [glossaryTerms, setGlossaryTerms] = useState<ModifiedGlossaryTerm[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [loadingChildren, setLoadingChildren] = useState<
    Record<string, boolean>
  >({});
  const [selectedStatus, setSelectedStatus] = useState<string[]>([
    Status.Approved,
    Status.Draft,
    Status.InReview,
  ]);

  const fetchGlossaryTerms = useCallback(
    async (page: number) => {
      if (!activeGlossary?.fullyQualifiedName) {
        return;
      }

      setIsLoading(true);
      try {
        const { data, paging } = await getFirstLevelGlossaryTermsPaginated(
          activeGlossary.fullyQualifiedName,
          page,
          PAGE_SIZE
        );

        if (page === 1) {
          setGlossaryTerms(data);
        } else {
          setGlossaryTerms((prev) => [...prev, ...data]);
        }

        setTotalCount(paging?.total || 0);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
      }
    },
    [activeGlossary?.fullyQualifiedName]
  );

  const loadChildrenTerms = useCallback(async (parentFQN: string) => {
    setLoadingChildren((prev) => ({ ...prev, [parentFQN]: true }));

    try {
      const { data } = await getGlossaryTermChildrenLazy(parentFQN, PAGE_SIZE);

      setGlossaryTerms((prev) => {
        const updateTermChildren = (
          terms: ModifiedGlossaryTerm[]
        ): ModifiedGlossaryTerm[] => {
          return terms.map((term) => {
            if (term.fullyQualifiedName === parentFQN) {
              return {
                ...term,
                children: data as ModifiedGlossaryTerm[],
              };
            }
            if (term.children) {
              return {
                ...term,
                children: updateTermChildren(
                  term.children as ModifiedGlossaryTerm[]
                ),
              };
            }

            return term;
          });
        };

        return updateTermChildren(prev);
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoadingChildren((prev) => ({ ...prev, [parentFQN]: false }));
    }
  }, []);

  const handleExpand = useCallback(
    async (expanded: boolean, record: ModifiedGlossaryTerm) => {
      const key = record.fullyQualifiedName || '';

      if (expanded && record.childrenCount && record.childrenCount > 0) {
        if (!record.children || record.children.length === 0) {
          await loadChildrenTerms(key);
        }
        setExpandedRowKeys((prev) => [...prev, key]);
      } else {
        setExpandedRowKeys((prev) => prev.filter((k) => k !== key));
      }
    },
    [loadChildrenTerms]
  );

  const handleLoadMore = useCallback(() => {
    if (!isLoading && glossaryTerms.length < totalCount) {
      const nextPage = Math.floor(glossaryTerms.length / PAGE_SIZE) + 1;
      setCurrentPage(nextPage);
      fetchGlossaryTerms(nextPage);
    }
  }, [isLoading, glossaryTerms.length, totalCount, fetchGlossaryTerms]);

  const filteredTerms = useMemo(() => {
    const filterByStatus = (
      terms: ModifiedGlossaryTerm[]
    ): ModifiedGlossaryTerm[] => {
      return terms.filter((term) => {
        const includesTerm = selectedStatus.includes(
          term.status || Status.Approved
        );
        if (term.children && term.children.length > 0) {
          const filteredChildren = filterByStatus(
            term.children as ModifiedGlossaryTerm[]
          );
          if (filteredChildren.length > 0) {
            term.children = filteredChildren;

            return true;
          }
        }

        return includesTerm;
      });
    };

    return filterByStatus([...glossaryTerms]);
  }, [glossaryTerms, selectedStatus]);

  const columns: ColumnsType<ModifiedGlossaryTerm> = useMemo(
    () => [
      {
        title: t('label.term'),
        dataIndex: 'name',
        key: 'name',
        width: glossaryTermTableColumnsWidth.name,
        render: (_, record) => (
          <div className="d-flex items-center">
            <Link to={getGlossaryPath(record.fullyQualifiedName || '')}>
              {getEntityName(record)}
            </Link>
            {record.style?.iconURL && (
              <img
                className="m-l-xs"
                data-testid="icon"
                height={16}
                src={record.style.iconURL}
                width={16}
              />
            )}
          </div>
        ),
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        width: glossaryTermTableColumnsWidth.description,
        render: (description: string) => (
          <RichTextEditorPreviewerNew
            className="line-clamp-1"
            markdown={description || ''}
            showReadMoreBtn={false}
          />
        ),
      },
      {
        title: t('label.status'),
        dataIndex: 'status',
        key: 'status',
        width: glossaryTermTableColumnsWidth.status,
        render: (status: Status) => (
          <StatusBadge
            dataTestId="glossary-term-status"
            label={status ?? Status.Approved}
            status={StatusClass[status ?? Status.Approved]}
          />
        ),
      },
      {
        title: t('label.owner'),
        dataIndex: 'owners',
        key: 'owners',
        width: glossaryTermTableColumnsWidth.owners,
        render: (owners) => <OwnerLabel owners={owners} />,
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        key: 'tags',
        width: glossaryTermTableColumnsWidth.tags,
        render: (tags) => <TagButton tags={tags} />,
      },
      {
        title: t('label.action-plural'),
        key: 'actions',
        width: glossaryTermTableColumnsWidth.actions,
        render: (_, record) => (
          <Space>
            <Tooltip title={t('label.edit')}>
              <Button
                className="p-0"
                data-testid={`edit-${record.name}`}
                disabled={!permissions.EditAll}
                icon={<EditIcon width={16} />}
                type="text"
                onClick={() => onEditGlossaryTerm?.(record)}
              />
            </Tooltip>
          </Space>
        ),
      },
    ],
    [permissions, onEditGlossaryTerm, t]
  );

  useEffect(() => {
    if (activeGlossary?.fullyQualifiedName) {
      setCurrentPage(1);
      setGlossaryTerms([]);
      fetchGlossaryTerms(1);
    }
  }, [activeGlossary?.fullyQualifiedName]);

  const expandable: TableProps<ModifiedGlossaryTerm>['expandable'] = {
    expandedRowKeys,
    onExpand: handleExpand,
    expandIcon: ({ expanded, onExpand, record }) => {
      if (!record.childrenCount || record.childrenCount === 0) {
        return null;
      }

      const isLoading = loadingChildren[record.fullyQualifiedName || ''];

      return (
        <Button
          className="p-0"
          icon={
            isLoading ? (
              <Loader size="small" />
            ) : expanded ? (
              <IconDown style={{ fontSize: '10px' }} />
            ) : (
              <IconRight style={{ fontSize: '10px' }} />
            )
          }
          type="text"
          onClick={(e) => onExpand?.(record, e)}
        />
      );
    },
  };

  return (
    <div className={className}>
      <Row gutter={[0, 16]}>
        <Col span={24}>
          <Space>
            <Dropdown
              menu={{
                items: GLOSSARY_TERM_STATUS_OPTIONS.map((option) => ({
                  key: option.value,
                  label: (
                    <Checkbox
                      checked={selectedStatus.includes(option.value as Status)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedStatus((prev) => [
                            ...prev,
                            option.value as Status,
                          ]);
                        } else {
                          setSelectedStatus((prev) =>
                            prev.filter((status) => status !== option.value)
                          );
                        }
                      }}>
                      {option.label}
                    </Checkbox>
                  ),
                })),
              }}
              trigger={['click']}>
              <Button icon={<DownOutlined />}>{t('label.status')}</Button>
            </Dropdown>

            {permissions.Create && (
              <Button
                data-testid="add-glossary-term"
                icon={<PlusOutlinedIcon />}
                type="primary"
                onClick={() => onAddGlossaryTerm?.()}>
                {t('label.add-entity', { entity: t('label.term') })}
              </Button>
            )}
          </Space>
        </Col>

        <Col span={24}>
          <Table
            columns={columns}
            dataSource={filteredTerms}
            expandable={expandable}
            loading={isLoading && currentPage === 1}
            pagination={false}
            rowKey="fullyQualifiedName"
            scroll={{ y: VIRTUAL_SCROLL_HEIGHT }}
            size="small"
          />

          {!isLoading && glossaryTerms.length < totalCount && (
            <div className="text-center m-t-md">
              <Button loading={isLoading} onClick={handleLoadMore}>
                {t('label.load-more')}
              </Button>
            </div>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default GlossaryTermTabOptimized;
