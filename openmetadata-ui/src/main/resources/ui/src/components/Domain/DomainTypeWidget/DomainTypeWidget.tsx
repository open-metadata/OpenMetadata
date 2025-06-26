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
import { Space, Typography } from 'antd';
import classNames from 'classnames';
import { t } from 'i18next';
import { cloneDeep } from 'lodash';
import React, { useMemo, useState } from 'react';
import { Domain, DomainType } from '../../../generated/entity/domains/domain';
import { domainTypeTooltipDataRender } from '../../../utils/DomainUtils';
import ExpandableCard from '../../common/ExpandableCard/ExpandableCard';
import FormItemLabel from '../../common/Form/FormItemLabel';
import { EditIconButton } from '../../common/IconButtons/EditIconButton';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import DomainTypeSelectForm from '../DomainTypeSelectForm/DomainTypeSelectForm.component';

export const DomainTypeWidget = () => {
  const {
    data: domain,
    permissions,
    onUpdate,
    isVersionView,
  } = useGenericContext<Domain>();
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

  const header = (
    <div className={classNames('d-flex items-center gap-2')}>
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

      {!isVersionView && editAllPermission && domain.domainType && (
        <EditIconButton
          newLook
          data-testid="edit-domainType-button"
          size="small"
          title={t('label.edit-entity', {
            entity: t('label.domain-type'),
          })}
          onClick={() => setEditDomainType(true)}
        />
      )}
    </div>
  );

  const content = (
    <>
      {!editDomainType && (
        <Space wrap data-testid="domain-type-label" size={6}>
          {domain?.domainType}
        </Space>
      )}

      {editDomainType && (
        <DomainTypeSelectForm
          defaultValue={domain.domainType}
          onCancel={() => setEditDomainType(false)}
          onSubmit={handleDomainTypeUpdate}
        />
      )}
    </>
  );

  return (
    <ExpandableCard
      cardProps={{
        title: header,
      }}
      dataTestId="domainType">
      {content}
    </ExpandableCard>
  );
};
