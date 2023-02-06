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

import { CheckOutlined, SearchOutlined } from '@ant-design/icons';
import { Col, Input, Modal, Row } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import Loader from 'components/Loader/Loader';
import React, { FC, useEffect, useState } from 'react';
import { getPolicies, getRoles } from 'rest/rolesAPIV1';
import { EntityType } from '../../../enums/entity.enum';
import { Policy } from '../../../generated/entity/policies/policy';
import { Role } from '../../../generated/entity/teams/role';
import { EntityReference } from '../../../generated/type/entityReference';
import { getEntityName } from '../../../utils/CommonUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import './AddAttributeModal.less';

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
  const [data, setData] = useState<EntityReference[]>([]);
  const [searchedData, setSearchedData] = useState<EntityReference[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedValues, setSelectedValues] = useState<string[]>(selectedKeys);

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

  const handleValuSelect = (id: string) => {
    const isAdded = selectedValues.includes(id);
    if (isAdded) {
      setSelectedValues((prev) => prev.filter((v) => v !== id));
    } else {
      setSelectedValues((prev) => [...prev, id]);
    }
  };

  const handleSearch = (value: string) => {
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
    <Modal
      centered
      className="ant-attribute-modal"
      closable={false}
      confirmLoading={isModalLoading}
      data-testid="modal-container"
      okText="Submit"
      open={isOpen}
      title={
        <span data-testid="modal-title">
          {title}{' '}
          <span className="text-grey-muted text-sm">
            {`(${selectedValues.length}/${data.length} selected)`}
          </span>
        </span>
      }
      width={750}
      onCancel={onCancel}
      onOk={() => onSave(selectedValues)}>
      {isLoading ? (
        <Loader />
      ) : (
        <>
          <Row className="ant-search-box-row">
            <Col span={24}>
              <Input
                data-testid="search-input"
                placeholder={`Search ${type}`}
                prefix={<SearchOutlined style={{ color: '#37352F4D' }} />}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </Col>
          </Row>
          {searchedData.map((option) => (
            <Row
              className={classNames({
                selected: selectedValues.includes(option.id),
              })}
              data-testid="policy-row"
              gutter={[16, 16]}
              key={option.id}
              onClick={() => handleValuSelect(option.id)}>
              <Col span={6}>{getEntityName(option)}</Col>
              <Col span={16}>
                <RichTextEditorPreviewer markdown={option.description || ''} />
              </Col>
              <Col span={2}>
                {selectedValues.includes(option.id) && (
                  <CheckOutlined className="text-primary" />
                )}
              </Col>
            </Row>
          ))}
        </>
      )}
    </Modal>
  );
};

export default AddAttributeModal;
