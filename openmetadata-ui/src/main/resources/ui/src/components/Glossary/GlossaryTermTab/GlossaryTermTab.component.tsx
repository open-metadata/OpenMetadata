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
import { ReactComponent as EditIcon } from 'assets/svg/edit-new.svg';
import { ReactComponent as UpDownArrowIcon } from 'assets/svg/ic-up-down-arrow.svg';
import { ReactComponent as PlusOutlinedIcon } from 'assets/svg/plus-outlined.svg';
import { AxiosError } from 'axios';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from 'components/PermissionProvider/PermissionProvider.interface';
import { FQN_SEPARATOR_CHAR } from 'constants/char.constants';
import { DE_ACTIVE_COLOR } from 'constants/constants';
import { GLOSSARIES_DOCS } from 'constants/docs.constants';
import { NO_PERMISSION_FOR_ACTION } from 'constants/HelperTextUtil';
import { TABLE_CONSTANTS } from 'constants/Teams.constants';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { compare } from 'fast-json-patch';
import { GlossaryTerm } from 'generated/entity/data/glossaryTerm';
import { Operation } from 'generated/entity/policies/policy';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useTranslation } from 'react-i18next';
import { Link, useHistory, useParams } from 'react-router-dom';
import { patchGlossaryTerm } from 'rest/glossaryAPI';
import { Transi18next } from 'utils/CommonUtils';
import { getEntityName } from 'utils/EntityUtils';
import { buildTree } from 'utils/GlossaryUtils';
import { checkPermission } from 'utils/PermissionsUtils';
import { getAddGlossaryTermsPath, getGlossaryPath } from 'utils/RouterUtils';
import { getTableExpandableConfig } from 'utils/TableUtils';
import { showErrorToast } from 'utils/ToastUtils';
import {
  DraggableBodyRowProps,
  GlossaryTermTabProps,
  ModifiedGlossaryTerm,
  MoveGlossaryTermType,
} from './GlossaryTermTab.interface';

const GlossaryTermTab = ({
  selectedGlossaryFqn,
  childGlossaryTerms = [],
  refreshGlossaryTerms,
}: GlossaryTermTabProps) => {
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  const history = useHistory();

  const { glossaryName } = useParams<{ glossaryName: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [glossaryTerms, setGlossaryTerms] = useState<ModifiedGlossaryTerm[]>(
    []
  );
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [movedGlossaryTerm, setMovedGlossaryTerm] =
    useState<MoveGlossaryTermType>();
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isTableLoading, setIsTableLoading] = useState(false);

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
        title: t('label.term-plural'),
        dataIndex: 'name',
        key: 'name',
        render: (_, record) => (
          <Link
            className="hover:tw-underline tw-cursor-pointer help-text"
            to={getGlossaryPath(record.fullyQualifiedName || record.name)}>
            {getEntityName(record)}
          </Link>
        ),
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        render: (description: string) =>
          description.trim() ? (
            <RichTextEditorPreviewer
              enableSeeMoreVariant
              markdown={description}
              maxLength={120}
            />
          ) : (
            <span className="tw-no-description">
              {t('label.no-description')}
            </span>
          ),
      },
    ];
    if (createGlossaryTermPermission) {
      data.push({
        title: t('label.action-plural'),
        key: 'new-term',
        render: (_, record) => (
          <div className="d-flex items-center">
            <Button
              className="add-new-term-btn text-grey-muted flex-center"
              data-testid="add-classification"
              icon={<PlusOutlinedIcon color={DE_ACTIVE_COLOR} width="14px" />}
              size="small"
              type="text"
              onClick={() => {
                handleAddGlossaryTermClick(record.fullyQualifiedName || '');
              }}
            />
            <Button
              className="cursor-pointer flex-center"
              data-testid="edit-button"
              icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
              size="small"
              type="text"
              onClick={() => console.debug('edit')}
            />
          </div>
        ),
      });
    }

    return data;
  }, [glossaryTerms]);

  const handleAddGlossaryTermClick = (glossaryFQN: string) => {
    if (glossaryFQN) {
      const activeTerm = glossaryFQN.split(FQN_SEPARATOR_CHAR);
      const glossary = activeTerm[0];
      if (activeTerm.length > 1) {
        history.push(getAddGlossaryTermsPath(glossary, glossaryFQN));
      } else {
        history.push(getAddGlossaryTermsPath(glossary));
      }
    } else {
      history.push(getAddGlossaryTermsPath(selectedGlossaryFqn ?? ''));
    }
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
    async (dragRecord: GlossaryTerm, dropRecord: GlossaryTerm) => {
      if (dragRecord.id === dropRecord.id) {
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

  const handleChangeGlossaryTerm = async () => {
    if (movedGlossaryTerm) {
      setIsTableLoading(true);
      const updatedGlossaryTerm = {
        ...movedGlossaryTerm.from,
        parent: {
          fullyQualifiedName: movedGlossaryTerm.to.fullyQualifiedName,
        },
      };
      const jsonPatch = compare(movedGlossaryTerm.from, updatedGlossaryTerm);

      try {
        await patchGlossaryTerm(movedGlossaryTerm.from?.id || '', jsonPatch);
        refreshGlossaryTerms && refreshGlossaryTerms();
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsTableLoading(false);
        setIsModalOpen(false);
      }
    }
  };

  const onTableRow: TableProps<ModifiedGlossaryTerm>['onRow'] = (
    record,
    index
  ) => {
    const attr = {
      index,
      handleMoveRow,
      record,
    };

    return attr as DraggableBodyRowProps;
  };

  const toggleExpandAll = () => {
    if (expandedRowKeys.length === childGlossaryTerms.length) {
      setExpandedRowKeys([]);
    } else {
      setExpandedRowKeys(
        childGlossaryTerms.map((item) => item.fullyQualifiedName || '')
      );
    }
  };

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

  if (isLoading) {
    return <Loader />;
  }

  if (glossaryTerms.length === 0) {
    return (
      <div className="m-t-xlg">
        <ErrorPlaceHolder
          buttons={
            <div className="tw-text-lg tw-text-center">
              <Tooltip
                title={
                  createGlossaryTermPermission
                    ? t('label.add-entity', {
                        entity: t('label.term-lowercase'),
                      })
                    : NO_PERMISSION_FOR_ACTION
                }>
                <Button
                  ghost
                  data-testid="add-new-tag-button"
                  type="primary"
                  onClick={() => handleAddGlossaryTermClick(glossaryName)}>
                  {t('label.add-entity', {
                    entity: t('label.glossary-term'),
                  })}
                </Button>
              </Tooltip>
            </div>
          }
          doc={GLOSSARIES_DOCS}
          heading={t('label.glossary-term')}
          type={ERROR_PLACEHOLDER_TYPE.ADD}
        />
      </div>
    );
  }

  return (
    <Row gutter={[0, 16]}>
      <Col span={24}>
        <div className="d-flex justify-end">
          <Button
            className="tw-text-primary tw-rounded m-b-lg"
            size="small"
            type="text"
            onClick={toggleExpandAll}>
            <Space align="center" size={4}>
              <UpDownArrowIcon color={DE_ACTIVE_COLOR} height="14px" />
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
              className="drop-over-background"
              columns={columns}
              components={TABLE_CONSTANTS}
              dataSource={glossaryTerms}
              expandable={expandableConfig}
              loading={isTableLoading}
              pagination={false}
              rowKey="fullyQualifiedName"
              size="small"
              onRow={onTableRow}
            />
          </DndProvider>
        ) : (
          <ErrorPlaceHolder>
            {t('message.no-entity-found-for-name')}
          </ErrorPlaceHolder>
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
          onCancel={() => setIsModalOpen(false)}
          onOk={handleChangeGlossaryTerm}>
          <Transi18next
            i18nKey="message.entity-transfer-message"
            renderElement={<strong />}
            values={{
              from: movedGlossaryTerm?.from.name,
              to: movedGlossaryTerm?.to.name,
              entity: t('label.term-lowercase'),
            }}
          />
        </Modal>
      </Col>
    </Row>
  );
};

export default GlossaryTermTab;
