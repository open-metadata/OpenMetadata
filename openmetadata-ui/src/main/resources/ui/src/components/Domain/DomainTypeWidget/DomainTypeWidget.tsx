/*
 *  Copyright 2025 Collate.
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
import { Button, Col, Space, Tooltip, Typography } from 'antd';
import { t } from 'i18next';
import { cloneDeep } from 'lodash';
import React, { useMemo, useState } from 'react';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { Domain, DomainType } from '../../../generated/entity/domains/domain';
import { domainTypeTooltipDataRender } from '../../../utils/DomainUtils';
import FormItemLabel from '../../common/Form/FormItemLabel';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import DomainTypeSelectForm from '../DomainTypeSelectForm/DomainTypeSelectForm.component';

export const DomainTypeWidget = () => {
  const { data: domain, permissions, onUpdate } = useGenericContext<Domain>();
  const [editDomainType, setEditDomainType] = useState(false);

  const { editAllPermission } = useMemo(
    () => ({
      editAllPermission: permissions.EditAll,
    }),
    [permissions]
  );

  const handleDomainTypeUpdate = async (domainType: string) => {
    let updatedDomain = cloneDeep(domain);
    updatedDomain = {
      ...updatedDomain,
      domainType: domainType as DomainType,
    };
    await onUpdate(updatedDomain);
    setEditDomainType(false);
  };

  return (
    <Col data-testid="domainType" span="24">
      <div className="d-flex items-center m-b-xss">
        <Typography.Text
          className="right-panel-label"
          data-testid="domainType-heading-name">
          <FormItemLabel
            align={{ targetOffset: [18, 0] }}
            helperText={domainTypeTooltipDataRender()}
            label={t('label.domain-type')}
            overlayClassName="domain-type-tooltip-container"
            placement="topLeft"
          />
        </Typography.Text>

        {editAllPermission && (domain as Domain).domainType && (
          <Tooltip
            title={t('label.edit-entity', {
              entity: t('label.domain-type'),
            })}>
            <Button
              className="cursor-pointer flex-center m-l-xss"
              data-testid="edit-domainType-button"
              icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
              size="small"
              type="text"
              onClick={() => setEditDomainType(true)}
            />
          </Tooltip>
        )}
      </div>
      {!editDomainType && (
        <Space wrap data-testid="domain-type-label" size={6}>
          {domain?.domainType}
        </Space>
      )}

      {editDomainType && (
        <DomainTypeSelectForm
          defaultValue={(domain as Domain).domainType}
          onCancel={() => setEditDomainType(false)}
          onSubmit={handleDomainTypeUpdate}
        />
      )}
    </Col>
  );
};
