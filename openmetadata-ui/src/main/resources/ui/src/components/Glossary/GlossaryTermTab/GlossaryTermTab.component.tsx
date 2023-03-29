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

import { Button, Col, Modal, Row, Table, TableProps, Tooltip } from 'antd';
import { ColumnsType, ExpandableConfig } from 'antd/lib/table/interface';
import { AxiosError } from 'axios';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from 'components/PermissionProvider/PermissionProvider.interface';
import { FQN_SEPARATOR_CHAR } from 'constants/char.constants';
import { API_RES_MAX_SIZE } from 'constants/constants';
import { NO_PERMISSION_FOR_ACTION } from 'constants/HelperTextUtil';
import { TABLE_CONSTANTS } from 'constants/Teams.constants';
import { compare } from 'fast-json-patch';
import { GlossaryTerm } from 'generated/entity/data/glossaryTerm';
import { Operation } from 'generated/entity/policies/policy';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useTranslation } from 'react-i18next';
import { Link, useHistory, useParams } from 'react-router-dom';
import {
  getGlossaryTerms,
  ListGlossaryTermsParams,
  patchGlossaryTerm,
} from 'rest/glossaryAPI';
import { Transi18next } from 'utils/CommonUtils';
import { getEntityName } from 'utils/EntityUtils';
import {
  createGlossaryTermTree,
  getRootLevelGlossaryTerm,
} from 'utils/GlossaryUtils';
import { checkPermission } from 'utils/PermissionsUtils';
import { getAddGlossaryTermsPath, getGlossaryPath } from 'utils/RouterUtils';
import { getTableExpandableConfig } from 'utils/TableUtils';
import { showErrorToast } from 'utils/ToastUtils';
import { ReactComponent as PlusIcon } from '../../../assets/svg/plus-primary.svg';
import {
  DraggableBodyRowProps,
  GlossaryTermTabProps,
  ModifiedGlossaryTerm,
  MoveGlossaryTermType,
} from './GlossaryTermTab.interface';

const GlossaryTermTab = ({
  glossaryId,
  glossaryTermId,
  selectedGlossaryFqn,
  childGlossaryTerms = [],
}: GlossaryTermTabProps) => {
  const { t } = useTranslation();
  const { permissions } = usePermissionProvider();
  const history = useHistory();

  const { glossaryName } = useParams<{ glossaryName: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [glossaryTerms, setGlossaryTerms] = useState<ModifiedGlossaryTerm[]>(
    []
  );
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
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        render: (description: string) =>
          description.trim() ? (
            <RichTextEditorPreviewer
              enableSeeMoreVariant
              markdown={description}
              maxLength={200}
            />
          ) : (
            <span className="tw-no-description">
              {t('label.no-description')}
            </span>
          ),
      },
      {
        title: t('label.action-plural'),
        key: 'new-term',
        render: (_, record) => (
          <Button
            className="text-primary d-flex items-center add-new-term-btn"
            data-testid="add-classification"
            icon={<PlusIcon className="anticon" />}
            size="small"
            onClick={() => {
              handleAddGlossaryTermClick(record.fullyQualifiedName || '');
            }}>
            <div className="tw-ml-1">{t('label.new-term')}</div>
          </Button>
        ),
      },
    ];

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

  const fetchGlossaryTerm = async (
    params?: ListGlossaryTermsParams,
    updateChild = false,
    isLoading = true
  ) => {
    setIsLoading(isLoading);
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
        setGlossaryTerms(updatedGlossaryTermTree);
      } else {
        setGlossaryTerms(updatedData as ModifiedGlossaryTerm[]);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const expandableConfig: ExpandableConfig<ModifiedGlossaryTerm> = useMemo(
    () => ({
      ...getTableExpandableConfig<ModifiedGlossaryTerm>(true),
      onExpand: (isOpen, record) => {
        if (isOpen) {
          fetchGlossaryTerm({ parent: record.id }, true, false);
        }
      },
    }),
    [fetchGlossaryTerm]
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
        await fetchGlossaryTerm(
          { glossary: glossaryId, parent: glossaryTermId },
          false,
          false
        );
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

  useEffect(() => {
    if (childGlossaryTerms) {
      const updatedData = getRootLevelGlossaryTerm(childGlossaryTerms, {
        glossary: glossaryId,
        parent: glossaryTermId,
      });
      setGlossaryTerms(updatedData as ModifiedGlossaryTerm[]);
    }
    setIsLoading(false);
  }, [childGlossaryTerms]);

  if (isLoading) {
    return <Loader />;
  }

  if (glossaryTerms.length === 0) {
    return (
      <ErrorPlaceHolder>
        {t('message.no-entity-data-available', {
          entity: t('label.glossary-term'),
        })}
        <Tooltip
          title={
            createGlossaryTermPermission
              ? t('label.add-entity', { entity: t('label.term-lowercase') })
              : NO_PERMISSION_FOR_ACTION
          }>
          <Button
            className="m-t-md"
            data-testid="add-new-tag-button"
            disabled={!createGlossaryTermPermission}
            size="middle"
            type="primary"
            onClick={() => handleAddGlossaryTermClick(glossaryName)}>
            {t('label.add-entity', { entity: t('label.term-lowercase') })}
          </Button>
        </Tooltip>
      </ErrorPlaceHolder>
    );
  }

  return (
    <Row gutter={[0, 16]}>
      <Col span={24}>
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
              rowKey="name"
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
