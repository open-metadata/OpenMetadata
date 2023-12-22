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

import {
  Button,
  Col,
  Modal,
  Row,
  Space,
  Table,
  TableProps,
  Tooltip,
} from 'antd';
import { ColumnsType, ExpandableConfig } from 'antd/lib/table/interface';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { isEmpty, isUndefined } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as DownUpArrowIcon } from '../../../assets/svg/ic-down-up-arrow.svg';
import { ReactComponent as UpDownArrowIcon } from '../../../assets/svg/ic-up-down-arrow.svg';
import { ReactComponent as PlusOutlinedIcon } from '../../../assets/svg/plus-outlined.svg';
import ErrorPlaceHolder from '../../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { OwnerLabel } from '../../../components/common/OwnerLabel/OwnerLabel.component';
import RichTextEditorPreviewer from '../../../components/common/RichTextEditor/RichTextEditorPreviewer';
import StatusBadge from '../../../components/common/StatusBadge/StatusBadge.component';
import Loader from '../../../components/Loader/Loader';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { GLOSSARIES_DOCS } from '../../../constants/docs.constants';
import { TABLE_CONSTANTS } from '../../../constants/Teams.constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import {
  EntityReference,
  GlossaryTerm,
  Status,
} from '../../../generated/entity/data/glossaryTerm';
import { patchGlossaryTerm } from '../../../rest/glossaryAPI';
import { Transi18next } from '../../../utils/CommonUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import Fqn from '../../../utils/Fqn';
import {
  buildTree,
  StatusClass,
  StatusFilters,
} from '../../../utils/GlossaryUtils';
import { getGlossaryPath } from '../../../utils/RouterUtils';
import {
  FilterIcon,
  getTableExpandableConfig,
} from '../../../utils/TableUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { DraggableBodyRowProps } from '../../Draggable/DraggableBodyRowProps.interface';
import {
  GlossaryTermTabProps,
  ModifiedGlossaryTerm,
  MoveGlossaryTermType,
} from './GlossaryTermTab.interface';

const GlossaryTermTab = ({
  childGlossaryTerms = [],
  refreshGlossaryTerms,
  permissions,
  isGlossary,
  selectedData,
  termsLoading,
  onAddGlossaryTerm,
  onEditGlossaryTerm,
  className,
}: GlossaryTermTabProps) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [glossaryTerms, setGlossaryTerms] = useState<ModifiedGlossaryTerm[]>(
    []
  );

  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [movedGlossaryTerm, setMovedGlossaryTerm] =
    useState<MoveGlossaryTermType>();
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isTableLoading, setIsTableLoading] = useState(false);
  const [isTableHovered, setIsTableHovered] = useState(false);

  const glossaryTermStatus: Status | null = useMemo(() => {
    if (!isGlossary) {
      return (selectedData as GlossaryTerm).status ?? Status.Approved;
    }

    return null;
  }, [isGlossary, selectedData]);

  const columns = useMemo(() => {
    const data: ColumnsType<ModifiedGlossaryTerm> = [
      {
        title: t('label.term-plural'),
        dataIndex: 'name',
        key: 'name',
        className: 'glossary-name-column',
        ellipsis: true,
        width: '40%',
        render: (_, record) => {
          const name = getEntityName(record);

          return (
            <>
              {record.style?.iconURL && (
                <img
                  className="m-r-xss vertical-baseline"
                  data-testid="tag-icon"
                  src={record.style.iconURL}
                  width={16}
                />
              )}
              <Link
                className="cursor-pointer vertical-baseline"
                data-testid={name}
                style={{ color: record.style?.color }}
                to={getGlossaryPath(record.fullyQualifiedName || record.name)}>
                {name}
              </Link>
            </>
          );
        },
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        width: permissions.Create ? '21%' : '33%',
        render: (description: string) =>
          description.trim() ? (
            <RichTextEditorPreviewer
              enableSeeMoreVariant
              markdown={description}
              maxLength={120}
            />
          ) : (
            <span className="text-grey-muted">{t('label.no-description')}</span>
          ),
      },
      {
        title: t('label.owner'),
        dataIndex: 'owner',
        key: 'owner',
        width: '15%',
        render: (owner: EntityReference) => <OwnerLabel owner={owner} />,
      },
      {
        title: t('label.status'),
        dataIndex: 'status',
        key: 'status',
        width: '12%',
        filterIcon: FilterIcon,
        filters: StatusFilters,
        render: (_, record) => {
          const status = record.status ?? Status.Approved;

          return (
            <StatusBadge
              dataTestId={record.fullyQualifiedName + '-status'}
              label={status}
              status={StatusClass[status]}
            />
          );
        },
        onFilter: (value, record) => record.status === value,
      },
    ];
    if (permissions.Create) {
      data.push({
        title: t('label.action-plural'),
        key: 'new-term',
        width: '12%',
        render: (_, record) => {
          const status = record.status ?? Status.Approved;
          const allowAddTerm = status === Status.Approved;

          return (
            <div className="d-flex items-center">
              {allowAddTerm && (
                <Tooltip
                  title={t('label.add-entity', {
                    entity: t('label.glossary-term'),
                  })}>
                  <Button
                    className="add-new-term-btn text-grey-muted flex-center"
                    data-testid="add-classification"
                    icon={
                      <PlusOutlinedIcon color={DE_ACTIVE_COLOR} width="14px" />
                    }
                    size="small"
                    type="text"
                    onClick={() => {
                      onAddGlossaryTerm(record as GlossaryTerm);
                    }}
                  />
                </Tooltip>
              )}

              <Tooltip
                title={t('label.edit-entity', {
                  entity: t('label.glossary-term'),
                })}>
                <Button
                  className="cursor-pointer flex-center"
                  data-testid="edit-button"
                  icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
                  size="small"
                  type="text"
                  onClick={() => onEditGlossaryTerm(record as GlossaryTerm)}
                />
              </Tooltip>
            </div>
          );
        },
      });
    }

    return data;
  }, [glossaryTerms, permissions]);

  const handleAddGlossaryTermClick = () => {
    onAddGlossaryTerm(!isGlossary ? (selectedData as GlossaryTerm) : undefined);
  };

  const expandableConfig: ExpandableConfig<ModifiedGlossaryTerm> = useMemo(
    () => ({
      ...getTableExpandableConfig<ModifiedGlossaryTerm>(true),
      expandedRowKeys,
      onExpand: (expanded, record) => {
        setExpandedRowKeys(
          expanded
            ? [...expandedRowKeys, record.fullyQualifiedName || '']
            : expandedRowKeys.filter((key) => key !== record.fullyQualifiedName)
        );
      },
    }),
    [expandedRowKeys]
  );

  const handleMoveRow = useCallback(
    async (dragRecord: GlossaryTerm, dropRecord?: GlossaryTerm) => {
      const dropRecordFqnPart =
        Fqn.split(dragRecord.fullyQualifiedName).length === 2;

      if (isUndefined(dropRecord) && dropRecordFqnPart) {
        return;
      }
      if (dragRecord.id === dropRecord?.id) {
        return;
      }

      setMovedGlossaryTerm({
        from: dragRecord,
        to: dropRecord,
      });
      setIsModalOpen(true);
    },
    []
  );

  const handleTableHover = (value: boolean) => setIsTableHovered(value);

  const handleChangeGlossaryTerm = async () => {
    if (movedGlossaryTerm) {
      setIsTableLoading(true);
      const newTermData = {
        ...movedGlossaryTerm.from,
        parent: isUndefined(movedGlossaryTerm.to)
          ? null
          : {
              fullyQualifiedName: movedGlossaryTerm.to.fullyQualifiedName,
            },
      };
      const jsonPatch = compare(movedGlossaryTerm.from, newTermData);

      try {
        await patchGlossaryTerm(movedGlossaryTerm.from?.id || '', jsonPatch);
        refreshGlossaryTerms && refreshGlossaryTerms();
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsTableLoading(false);
        setIsModalOpen(false);
        setIsTableHovered(false);
      }
    }
  };

  const onTableRow: TableProps<ModifiedGlossaryTerm>['onRow'] = (
    record,
    index
  ) =>
    ({
      index,
      handleMoveRow,
      handleTableHover,
      record,
    } as DraggableBodyRowProps<GlossaryTerm>);

  const onTableHeader: TableProps<ModifiedGlossaryTerm>['onHeaderRow'] = () =>
    ({
      handleMoveRow,
      handleTableHover,
    } as DraggableBodyRowProps<GlossaryTerm>);

  const toggleExpandAll = () => {
    if (expandedRowKeys.length === childGlossaryTerms.length) {
      setExpandedRowKeys([]);
    } else {
      setExpandedRowKeys(
        childGlossaryTerms.map((item) => item.fullyQualifiedName || '')
      );
    }
  };

  const onDragConfirmationModalClose = useCallback(() => {
    setIsModalOpen(false);
    setIsTableHovered(false);
  }, []);

  useEffect(() => {
    if (childGlossaryTerms) {
      const data = buildTree(childGlossaryTerms);
      setGlossaryTerms(data as ModifiedGlossaryTerm[]);
      setExpandedRowKeys(
        childGlossaryTerms.map((item) => item.fullyQualifiedName || '')
      );
    }
    setIsLoading(false);
  }, [childGlossaryTerms]);

  if (termsLoading || isLoading) {
    return <Loader />;
  }

  if (isEmpty(glossaryTerms)) {
    return (
      <ErrorPlaceHolder
        className="m-t-xlg"
        doc={GLOSSARIES_DOCS}
        heading={t('label.glossary-term')}
        permission={permissions.Create}
        type={
          permissions.Create && glossaryTermStatus === Status.Approved
            ? ERROR_PLACEHOLDER_TYPE.CREATE
            : ERROR_PLACEHOLDER_TYPE.NO_DATA
        }
        onClick={handleAddGlossaryTermClick}
      />
    );
  }

  return (
    <Row className={className} gutter={[0, 16]}>
      <Col span={24}>
        <div className="d-flex justify-end">
          <Button
            className="text-primary m-b-sm"
            size="small"
            type="text"
            onClick={toggleExpandAll}>
            <Space align="center" size={4}>
              {expandedRowKeys.length === childGlossaryTerms.length ? (
                <DownUpArrowIcon color={DE_ACTIVE_COLOR} height="14px" />
              ) : (
                <UpDownArrowIcon color={DE_ACTIVE_COLOR} height="14px" />
              )}

              {expandedRowKeys.length === childGlossaryTerms.length
                ? t('label.collapse-all')
                : t('label.expand-all')}
            </Space>
          </Button>
        </div>

        {glossaryTerms.length > 0 ? (
          <DndProvider backend={HTML5Backend}>
            <Table
              bordered
              className={classNames('drop-over-background', {
                'drop-over-table': isTableHovered,
              })}
              columns={columns}
              components={TABLE_CONSTANTS}
              dataSource={glossaryTerms}
              expandable={expandableConfig}
              loading={isTableLoading}
              pagination={false}
              rowKey="fullyQualifiedName"
              size="small"
              tableLayout="fixed"
              onHeaderRow={onTableHeader}
              onRow={onTableRow}
            />
          </DndProvider>
        ) : (
          <ErrorPlaceHolder />
        )}
        <Modal
          centered
          destroyOnClose
          closable={false}
          confirmLoading={isTableLoading}
          data-testid="confirmation-modal"
          maskClosable={false}
          okText={t('label.confirm')}
          open={isModalOpen}
          title={t('label.move-the-entity', {
            entity: t('label.glossary-term'),
          })}
          onCancel={onDragConfirmationModalClose}
          onOk={handleChangeGlossaryTerm}>
          <Transi18next
            i18nKey="message.entity-transfer-message"
            renderElement={<strong />}
            values={{
              from: movedGlossaryTerm?.from.name,
              to: movedGlossaryTerm?.to?.name ?? getEntityName(selectedData),
              entity: isUndefined(movedGlossaryTerm?.to)
                ? ''
                : t('label.term-lowercase'),
            }}
          />
        </Modal>
      </Col>
    </Row>
  );
};

export default GlossaryTermTab;
