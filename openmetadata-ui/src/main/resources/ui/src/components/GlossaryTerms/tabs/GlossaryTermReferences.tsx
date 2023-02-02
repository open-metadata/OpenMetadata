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

import { Button, Col, Form, Input, Row, Typography } from 'antd';
import { cloneDeep, isEqual } from 'lodash';
import React, { Fragment, useEffect, useState } from 'react';
import {
  GlossaryTerm,
  TermReference,
} from '../../../generated/entity/data/glossaryTerm';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { OperationPermission } from '../../PermissionProvider/PermissionProvider.interface';
import SummaryDetail from '../SummaryDetail';

interface GlossaryTermReferences {
  glossaryTerm: GlossaryTerm;
  permissions: OperationPermission;
  onGlossaryTermUpdate: (glossaryTerm: GlossaryTerm) => void;
}

const GlossaryTermReferences = ({
  glossaryTerm,
  permissions,
  onGlossaryTermUpdate,
}: GlossaryTermReferences) => {
  const [form] = Form.useForm();
  const [references, setReferences] = useState<TermReference[]>([]);
  const [isViewMode, setIsViewMode] = useState<boolean>(true);

  const handleReferencesSave = async () => {
    try {
      const updatedRef = references.filter((ref) => ref.endpoint && ref.name);

      setReferences(updatedRef);
      await form.validateFields();
      form.resetFields(['references']);
      if (!isEqual(updatedRef, glossaryTerm.references)) {
        let updatedGlossaryTerm = cloneDeep(glossaryTerm);
        updatedGlossaryTerm = {
          ...updatedGlossaryTerm,
          references: updatedRef,
        };

        onGlossaryTermUpdate(updatedGlossaryTerm);
      }
      setIsViewMode(true);
    } catch (error) {
      // Added catch block to prevent uncaught promise
    }
  };

  useEffect(() => {
    if (glossaryTerm.references?.length) {
      setReferences(glossaryTerm.references);
    }
  }, [glossaryTerm]);

  return (
    <div data-testid="references-container">
      {isViewMode ? (
        <SummaryDetail
          hasAccess={permissions.EditAll}
          key="references"
          setShow={() => setIsViewMode(false)}
          showIcon={isViewMode}
          title="References">
          <div className="flex">
            {references.length > 0 ? (
              references.map((ref, i) => (
                <Fragment key={i}>
                  {i > 0 && <span className="m-r-xs">,</span>}
                  <a
                    className="flex"
                    data-testid="owner-link"
                    href={ref?.endpoint}
                    rel="noopener noreferrer"
                    target="_blank">
                    <Typography.Text
                      className="link-text-info"
                      ellipsis={{ tooltip: ref?.name }}
                      style={{ maxWidth: 200 }}>
                      {ref?.name}
                    </Typography.Text>
                  </a>
                </Fragment>
              ))
            ) : (
              <Typography.Text type="secondary">
                No references available.
              </Typography.Text>
            )}
          </div>
        </SummaryDetail>
      ) : (
        <Form
          className="reference-edit-form"
          form={form}
          onValuesChange={(_, values) => setReferences(values.references)}>
          <Form.List
            initialValue={
              references.length
                ? references
                : [
                    {
                      name: '',
                      endpoint: '',
                    },
                  ]
            }
            name="references">
            {(fields, { add, remove }) => (
              <SummaryDetail
                showAddIcon
                hasAccess={permissions.EditAll}
                key="references"
                setShow={() => setIsViewMode(false)}
                showIcon={isViewMode}
                title="References"
                onAddClick={() => add()}
                onSave={handleReferencesSave}>
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Row gutter={8} key={key}>
                      <Col span={12}>
                        <Form.Item
                          className="w-full"
                          {...restField}
                          name={[name, 'name']}>
                          <Input placeholder="Name" />
                        </Form.Item>
                      </Col>
                      <Col span={11}>
                        <Form.Item
                          className="w-full"
                          {...restField}
                          name={[name, 'endpoint']}
                          rules={[
                            {
                              type: 'url',
                              message: 'Endpoint should be valid URL.',
                            },
                          ]}>
                          <Input placeholder="End point" />
                        </Form.Item>
                      </Col>
                      <Col span={1}>
                        <Button
                          icon={
                            <SVGIcons
                              alt="delete"
                              icon={Icons.DELETE}
                              width="16px"
                            />
                          }
                          size="small"
                          type="text"
                          onClick={() => remove(name)}
                        />
                      </Col>
                    </Row>
                  ))}
                </>
              </SummaryDetail>
            )}
          </Form.List>
        </Form>
      )}
    </div>
  );
};

export default GlossaryTermReferences;
