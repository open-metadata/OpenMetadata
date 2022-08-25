/*
 *  Copyright 2021 Collate
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

import { Modal, Table, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { getPolicies } from '../../../axiosAPIs/rolesAPIV1';
import RichTextEditorPreviewer from '../../../components/common/rich-text-editor/RichTextEditorPreviewer';
import Loader from '../../../components/Loader/Loader';
import { EntityType } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/type/entityReference';
import { getEntityName } from '../../../utils/CommonUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

interface Props {
  type: EntityType;
  selectedKeys: React.Key[];
  title: string;
  isOpen: boolean;
  onSave: () => void;
  onCancel: () => void;
}

interface DataType extends EntityReference {
  key: React.Key;
}

const AddAttributeModal: FC<Props> = ({
  isOpen,
  onSave,
  onCancel,
  title,
  type,
  selectedKeys,
}) => {
  const [data, setData] = useState<DataType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedRowKeys, setKeys] = useState<React.Key[]>(selectedKeys);

  const fetchPolicies = async () => {
    setIsLoading(true);
    try {
      const data = await getPolicies('');

      const entityReferenceData: DataType[] = (data.data || []).map(
        (record) => ({
          id: record.id,
          key: record.id,
          name: record.name,
          displayName: record.displayName,
          type,
          description: record.description,
        })
      );

      setData(entityReferenceData);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const columns: ColumnsType<DataType> = useMemo(() => {
    return [
      {
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
        render: (_, record) => {
          return <Typography.Text>{getEntityName(record)}</Typography.Text>;
        },
      },
      {
        title: 'Description',
        dataIndex: 'description',
        key: 'description',
        render: (_, record) => (
          <RichTextEditorPreviewer markdown={record?.description || ''} />
        ),
      },
    ];
  }, []);

  const rowSelection = {
    onChange: (selectedRowKeys: React.Key[]) => {
      setKeys(selectedRowKeys);
    },
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  return (
    <Modal
      centered
      okText="Submit"
      title={title}
      visible={isOpen}
      width={750}
      onCancel={onCancel}
      onOk={onSave}>
      {isLoading ? (
        <Loader />
      ) : (
        <Table
          columns={columns}
          dataSource={data}
          pagination={false}
          rowSelection={{
            type: 'checkbox',
            ...rowSelection,
            selectedRowKeys,
          }}
          size="middle"
        />
      )}
    </Modal>
  );
};

export default AddAttributeModal;
