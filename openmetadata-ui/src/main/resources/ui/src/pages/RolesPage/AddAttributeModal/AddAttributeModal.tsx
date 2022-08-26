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

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Col, Input, Modal, Row } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import React, { FC, useEffect, useState } from 'react';
import { getPolicies } from '../../../axiosAPIs/rolesAPIV1';
import RichTextEditorPreviewer from '../../../components/common/rich-text-editor/RichTextEditorPreviewer';
import Loader from '../../../components/Loader/Loader';
import { EntityType } from '../../../enums/entity.enum';
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
}

const AddAttributeModal: FC<Props> = ({
  isOpen,
  onSave,
  onCancel,
  title,
  type,
  selectedKeys,
}) => {
  const [data, setData] = useState<EntityReference[]>([]);
  const [searchedData, setSearchedData] = useState<EntityReference[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedValues, setSelectedValues] = useState<string[]>(selectedKeys);

  const fetchPolicies = async () => {
    setIsLoading(true);
    try {
      const data = await getPolicies('');

      const entityReferenceData: EntityReference[] = (data.data || []).map(
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
      okText="Submit"
      title={
        <>
          {title}{' '}
          <span className="tw-text-grey-muted tw-text-sm">
            ({selectedValues.length}/{data.length} selected)
          </span>
        </>
      }
      visible={isOpen}
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
                placeholder={`Search ${type}`}
                prefix={
                  <FontAwesomeIcon
                    icon="search"
                    style={{ color: '#37352F4D' }}
                  />
                }
                onChange={(e) => handleSearch(e.target.value)}
              />
            </Col>
          </Row>
          {searchedData.map((option) => (
            <Row
              className={classNames({
                selected: selectedValues.includes(option.id),
              })}
              gutter={[16, 16]}
              key={option.id}
              onClick={() => handleValuSelect(option.id)}>
              <Col span={6}>{getEntityName(option)}</Col>
              <Col span={16}>
                <RichTextEditorPreviewer markdown={option.description || ''} />
              </Col>
              <Col span={2}>
                {selectedValues.includes(option.id) && (
                  <FontAwesomeIcon className="tw-text-primary" icon="check" />
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
