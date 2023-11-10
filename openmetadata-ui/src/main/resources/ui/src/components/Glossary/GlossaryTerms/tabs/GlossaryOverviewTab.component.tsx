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
import { Col, Row, Space } from 'antd';
import React, { useMemo, useState } from 'react';
import { EntityField } from '../../../../constants/Feeds.constants';
import { EntityType } from '../../../../enums/entity.enum';
import { Glossary } from '../../../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../../../generated/entity/data/glossaryTerm';
import { ChangeDescription } from '../../../../generated/entity/type';
import { TagLabel } from '../../../../generated/type/tagLabel';
import {
  getEntityVersionByField,
  getEntityVersionTags,
} from '../../../../utils/EntityVersionUtils';
import DescriptionV1 from '../../../common/EntityDescription/DescriptionV1';
import { OperationPermission } from '../../../PermissionProvider/PermissionProvider.interface';
import TagsInput from '../../../TagsInput/TagsInput.component';
import GlossaryDetailsRightPanel from '../../GlossaryDetailsRightPanel/GlossaryDetailsRightPanel.component';
import GlossaryTermReferences from './GlossaryTermReferences';
import GlossaryTermSynonyms from './GlossaryTermSynonyms';
import RelatedTerms from './RelatedTerms';

type Props = {
  selectedData: Glossary | GlossaryTerm;
  permissions: OperationPermission;
  onUpdate: (data: GlossaryTerm | Glossary) => Promise<void>;
  isGlossary: boolean;
  isVersionView?: boolean;
};

const GlossaryOverviewTab = ({
  selectedData,
  permissions,
  onUpdate,
  isGlossary,
  isVersionView,
}: Props) => {
  const [isDescriptionEditable, setIsDescriptionEditable] =
    useState<boolean>(false);

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (selectedData.description !== updatedHTML) {
      const updatedTableDetails = {
        ...selectedData,
        description: updatedHTML,
      };
      onUpdate(updatedTableDetails);
      setIsDescriptionEditable(false);
    } else {
      setIsDescriptionEditable(false);
    }
  };

  const hasEditTagsPermissions = useMemo(() => {
    return permissions.EditAll || permissions.EditTags;
  }, [permissions]);

  const glossaryDescription = useMemo(() => {
    if (isVersionView) {
      return getEntityVersionByField(
        selectedData.changeDescription as ChangeDescription,
        EntityField.DESCRIPTION,
        selectedData.description
      );
    } else {
      return selectedData.description;
    }
  }, [selectedData, isVersionView]);

  const handleTagsUpdate = async (updatedTags: TagLabel[]) => {
    if (updatedTags) {
      const updatedData = {
        ...selectedData,
        tags: updatedTags,
      };

      onUpdate(updatedData);
    }
  };

  const tags = useMemo(
    () =>
      isVersionView
        ? getEntityVersionTags(
            selectedData,
            selectedData.changeDescription as ChangeDescription
          )
        : selectedData.tags,
    [isVersionView, selectedData]
  );

  return (
    <Row className="glossary-overview-tab h-full" gutter={[32, 16]}>
      <Col
        className="border-right"
        data-testid="updated-by-container"
        span={18}>
        <Row className="p-md p-r-0" gutter={[0, 32]}>
          <Col span={24}>
            <DescriptionV1
              description={glossaryDescription}
              entityName={selectedData?.displayName ?? selectedData?.name}
              entityType={EntityType.GLOSSARY}
              hasEditAccess={permissions.EditDescription || permissions.EditAll}
              isEdit={isDescriptionEditable}
              showCommentsIcon={false}
              onCancel={() => setIsDescriptionEditable(false)}
              onDescriptionEdit={() => setIsDescriptionEditable(true)}
              onDescriptionUpdate={onDescriptionUpdate}
            />
          </Col>
          <Col span={24}>
            <Row gutter={[0, 40]}>
              {!isGlossary && (
                <>
                  <Col span={12}>
                    <GlossaryTermSynonyms
                      glossaryTerm={selectedData as GlossaryTerm}
                      isVersionView={isVersionView}
                      permissions={permissions}
                      onGlossaryTermUpdate={onUpdate}
                    />
                  </Col>
                  <Col span={12}>
                    <RelatedTerms
                      glossaryTerm={selectedData as GlossaryTerm}
                      isVersionView={isVersionView}
                      permissions={permissions}
                      onGlossaryTermUpdate={onUpdate}
                    />
                  </Col>
                  <Col span={12}>
                    <GlossaryTermReferences
                      glossaryTerm={selectedData as GlossaryTerm}
                      isVersionView={isVersionView}
                      permissions={permissions}
                      onGlossaryTermUpdate={onUpdate}
                    />
                  </Col>
                </>
              )}

              <Col span={12}>
                <Space className="w-full" direction="vertical">
                  <TagsInput
                    editable={hasEditTagsPermissions}
                    isVersionView={isVersionView}
                    tags={tags}
                    onTagsUpdate={handleTagsUpdate}
                  />
                </Space>
              </Col>
            </Row>
          </Col>
        </Row>
      </Col>
      <Col className="p-t-md" span={6}>
        <GlossaryDetailsRightPanel
          isGlossary={false}
          isVersionView={isVersionView}
          permissions={permissions}
          selectedData={selectedData}
          onUpdate={onUpdate}
        />
      </Col>
    </Row>
  );
};

export default GlossaryOverviewTab;
