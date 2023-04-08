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

import { Col, Row, Space } from 'antd';
import DescriptionV1 from 'components/common/description/DescriptionV1';
import GlossaryHeader from 'components/Glossary/GlossaryHeader/GlossaryHeader.component';
import GlossaryTermTab from 'components/Glossary/GlossaryTermTab/GlossaryTermTab.component';
import GlossaryDetailsRightPanel from 'components/GlossaryDetailsRightPanel/GlossaryDetailsRightPanel.component';
import { GlossaryTerm } from 'generated/entity/data/glossaryTerm';
import React, { useState } from 'react';
import { Glossary } from '../../generated/entity/data/glossary';
import { OperationPermission } from '../PermissionProvider/PermissionProvider.interface';
import './GlossaryDetails.style.less';

type props = {
  permissions: OperationPermission;
  glossary: Glossary;
  glossaryTerms: GlossaryTerm[];
  updateGlossary: (value: Glossary) => Promise<void>;
  handleGlossaryDelete: (id: string) => void;
  refreshGlossaryTerms: () => void;
};

const GlossaryDetails = ({
  permissions,
  glossary,
  updateGlossary,
  handleGlossaryDelete,
  glossaryTerms,
  refreshGlossaryTerms,
}: props) => {
  const [isDescriptionEditable, setIsDescriptionEditable] =
    useState<boolean>(false);

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (glossary.description !== updatedHTML) {
      const updatedTableDetails = {
        ...glossary,
        description: updatedHTML,
      };
      updateGlossary(updatedTableDetails);
      setIsDescriptionEditable(false);
    } else {
      setIsDescriptionEditable(false);
    }
  };

  return (
    <Row data-testid="glossary-details" gutter={[0, 16]}>
      <Col span={24}>
        <GlossaryHeader
          isGlossary
          permissions={permissions}
          selectedData={glossary}
          onDelete={handleGlossaryDelete}
          onUpdate={updateGlossary}
        />
      </Col>

      <Col span={24}>
        <Row gutter={[16, 16]}>
          <Col span={18}>
            <Space className="w-full" direction="vertical" size={24}>
              <DescriptionV1
                wrapInCard
                description={glossary?.description || ''}
                entityName={glossary?.displayName ?? glossary?.name}
                hasEditAccess={
                  permissions.EditDescription || permissions.EditAll
                }
                isEdit={isDescriptionEditable}
                onCancel={() => setIsDescriptionEditable(false)}
                onDescriptionEdit={() => setIsDescriptionEditable(true)}
                onDescriptionUpdate={onDescriptionUpdate}
              />
              <GlossaryTermTab
                childGlossaryTerms={glossaryTerms}
                refreshGlossaryTerms={refreshGlossaryTerms}
                selectedGlossaryFqn={
                  glossary.fullyQualifiedName || glossary.name
                }
              />
            </Space>
          </Col>
          <Col span={6}>
            <GlossaryDetailsRightPanel
              isGlossary
              permissions={permissions}
              selectedData={glossary}
              onUpdate={updateGlossary}
            />
          </Col>
        </Row>
      </Col>
    </Row>
  );
};

export default GlossaryDetails;
