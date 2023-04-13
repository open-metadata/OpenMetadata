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
import { Col, Row } from 'antd';
import { ReactComponent as IconFolder } from 'assets/svg/folder.svg';
import { ReactComponent as IconFlatDoc } from 'assets/svg/ic-flat-doc.svg';
import { TitleBreadcrumbProps } from 'components/common/title-breadcrumb/title-breadcrumb.interface';
import { EntityHeader } from 'components/Entity/EntityHeader/EntityHeader.component';
import { OperationPermission } from 'components/PermissionProvider/PermissionProvider.interface';
import { FQN_SEPARATOR_CHAR } from 'constants/char.constants';
import { DE_ACTIVE_COLOR } from 'constants/constants';
import { EntityType } from 'enums/entity.enum';
import { Glossary } from 'generated/entity/data/glossary';
import { GlossaryTerm } from 'generated/entity/data/glossaryTerm';
import React, { useEffect, useState } from 'react';
import { getGlossaryPath } from 'utils/RouterUtils';
import GlossaryHeaderButtons from '../GlossaryHeaderButtons/GlossaryHeaderButtons.component';

export interface GlossaryHeaderProps {
  supportAddOwner?: boolean;
  selectedData: Glossary | GlossaryTerm;
  permissions: OperationPermission;
  isGlossary: boolean;
  onUpdate: (data: GlossaryTerm | Glossary) => void;
  onDelete: (id: string) => void;
  onAssetAdd?: () => void;
}

const GlossaryHeader = ({
  selectedData,
  permissions,
  onUpdate,
  onDelete,
  isGlossary,
  onAssetAdd,
}: GlossaryHeaderProps) => {
  const [breadcrumb, setBreadcrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);

  /**
   * To create breadcrumb from the fqn
   * @param fqn fqn of glossary or glossary term
   */
  const handleBreadcrumb = (fqn: string) => {
    if (!fqn) {
      return;
    }

    const arr = fqn.split(FQN_SEPARATOR_CHAR);
    const dataFQN: Array<string> = [];
    const newData = [
      {
        name: 'Glossaries',
        url: getGlossaryPath(arr[0]),
        activeTitle: false,
      },
      ...arr.slice(0, -1).map((d) => {
        dataFQN.push(d);

        return {
          name: d,
          url: getGlossaryPath(dataFQN.join(FQN_SEPARATOR_CHAR)),
          activeTitle: false,
        };
      }),
    ];

    setBreadcrumb(newData);
  };

  useEffect(() => {
    const { fullyQualifiedName, name } = selectedData;
    handleBreadcrumb(fullyQualifiedName ? fullyQualifiedName : name);
  }, [selectedData]);

  return (
    <>
      <Row gutter={[0, 16]}>
        <Col span={24}>
          <EntityHeader
            breadcrumb={breadcrumb}
            entityData={selectedData}
            entityType={EntityType.GLOSSARY_TERM}
            extra={
              <div style={{ textAlign: 'right' }}>
                <GlossaryHeaderButtons
                  deleteStatus="success"
                  isGlossary={isGlossary}
                  permission={permissions}
                  selectedData={selectedData}
                  onAssetAdd={onAssetAdd && onAssetAdd}
                  onEntityDelete={onDelete}
                  onUpdate={onUpdate}
                />
              </div>
            }
            gutter="large"
            icon={
              isGlossary ? (
                <IconFolder
                  color={DE_ACTIVE_COLOR}
                  height={36}
                  name="folder"
                  width={32}
                />
              ) : (
                <IconFlatDoc
                  color={DE_ACTIVE_COLOR}
                  height={36}
                  name="doc"
                  width={32}
                />
              )
            }
          />
        </Col>
      </Row>
    </>
  );
};

export default GlossaryHeader;
