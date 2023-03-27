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

import { Card, Col, Divider, Row, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import ProfilePicture from 'components/common/ProfilePicture/ProfilePicture';
import GlossaryTermReferences from 'components/GlossaryTerms/tabs/GlossaryTermReferences';
import GlossaryTermSynonyms from 'components/GlossaryTerms/tabs/GlossaryTermSynonyms';
import RelatedTerms from 'components/GlossaryTerms/tabs/RelatedTerms';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import TagsInput from 'components/TagsInput/TagsInput.component';
import { getUserPath } from 'constants/constants';
import { Glossary } from 'generated/entity/data/glossary';
import { GlossaryTerm } from 'generated/entity/data/glossaryTerm';
import { TagLabel } from 'generated/type/tagLabel';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getEntityName } from 'utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from 'utils/PermissionsUtils';
import { showErrorToast } from 'utils/ToastUtils';
import { ReactComponent as IconLink } from '../../../assets/svg/link.svg';

interface GlossaryRightPanelProps {
  entityDetails: Glossary | GlossaryTerm;
  isGlossary: boolean;
  onGlossaryTermUpdate: (value: GlossaryTerm) => Promise<void>;
  onGlossaryUpdate: (value: Glossary) => Promise<void>;
}

const GlossaryRightPanel = ({
  entityDetails,
  isGlossary,
  onGlossaryTermUpdate,
  onGlossaryUpdate,
}: GlossaryRightPanelProps) => {
  const { t } = useTranslation();
  const { getEntityPermission } = usePermissionProvider();

  const [glossaryPermission, setGlossaryPermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const [glossaryTermPermission, setGlossaryTermPermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const fetchGlossaryPermission = async () => {
    try {
      const response = await getEntityPermission(
        ResourceEntity.GLOSSARY,
        entityDetails?.id as string
      );
      setGlossaryPermission(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const fetchGlossaryTermPermission = async () => {
    try {
      const response = await getEntityPermission(
        ResourceEntity.GLOSSARY_TERM,
        entityDetails?.id as string
      );
      setGlossaryTermPermission(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  useEffect(() => {
    if (isGlossary) {
      fetchGlossaryPermission();
    } else {
      fetchGlossaryTermPermission();
    }
  }, [entityDetails]);

  const hasEditTagsPermissions = useMemo(() => {
    return isGlossary
      ? glossaryPermission.EditAll || glossaryPermission.EditTags
      : glossaryTermPermission.EditAll || glossaryTermPermission.EditTags;
  }, [glossaryPermission, glossaryTermPermission]);

  const handleTagsUpdate = async (updatedTags: TagLabel[]) => {
    if (updatedTags) {
      const updatedData = {
        ...entityDetails,
        tags: updatedTags,
      };

      if (isGlossary) {
        await onGlossaryUpdate(updatedData);
      } else {
        await onGlossaryTermUpdate(updatedData as GlossaryTerm);
      }
    }
  };

  return (
    <Card
      className="right-panel-card tw-h-full page-layout-v1-right-panel page-layout-v1-vertical-scroll"
      data-testid="glossary-right-panel">
      <Typography.Title className="m-0" level={5}>
        {t('label.summary')}
      </Typography.Title>

      <Row
        className="m-y-md"
        data-testid="reviewer-card-container"
        gutter={[0, 8]}>
        <Col span={24}>
          <Typography.Text
            className="text-grey-muted"
            data-testid="profiler-header">
            {t('label.reviewer-plural')}
          </Typography.Text>
        </Col>
        <Col span={24}>
          {entityDetails.reviewers && entityDetails.reviewers.length ? (
            <>
              {entityDetails.reviewers.map((reviewer) => (
                <Space
                  className="m-r-xs"
                  data-testid={`reviewer-${reviewer.displayName}`}
                  key={reviewer.name}
                  size={6}>
                  <ProfilePicture
                    displayName={getEntityName(reviewer)}
                    id={reviewer.id || ''}
                    name={reviewer?.name || ''}
                    textClass="text-xs"
                    width="20"
                  />
                  <Space size={2}>
                    <Link to={getUserPath(reviewer.name ?? '')}>
                      {getEntityName(reviewer)}
                    </Link>
                  </Space>
                </Space>
              ))}
            </>
          ) : (
            <Typography.Text
              className="text-grey-body"
              data-testid="no-related-terms-available-header">
              {t('label.no-entity', {
                entity: t('label.reviewer-plural'),
              })}
            </Typography.Text>
          )}
        </Col>
      </Row>

      <Divider className="m-y-xs" />

      <Row className="m-y-md" data-testid="tags-card-container" gutter={[0, 8]}>
        <Col span={24}>
          <Typography.Text
            className="text-grey-muted"
            data-testid="profiler-header">
            {t('label.tag-plural')}
          </Typography.Text>
        </Col>
        <Col span={24}>
          <TagsInput
            editable={hasEditTagsPermissions}
            tags={entityDetails.tags}
            onTagsUpdate={handleTagsUpdate}
          />
        </Col>
      </Row>

      <Divider className="m-y-xs" />

      {!isGlossary && (
        <>
          <Row className="m-y-md" gutter={[0, 8]}>
            <Col span={24}>
              <Typography.Text
                className="text-grey-muted"
                data-testid="profiler-header">
                {t('label.synonym-plural')}
              </Typography.Text>
            </Col>
            <Col span={24}>
              <GlossaryTermSynonyms
                glossaryTerm={entityDetails as GlossaryTerm}
                permissions={glossaryTermPermission}
                onGlossaryTermUpdate={onGlossaryTermUpdate}
              />
            </Col>
          </Row>

          <Divider className="m-y-xs" />

          <Row className="m-y-md" gutter={[0, 8]}>
            <Col span={24}>
              <div className="d-flex items-center">
                <IconLink
                  className="tw-align-middle"
                  height={16}
                  name="link"
                  width={16}
                />
                <Typography.Text
                  className="text-grey-muted tw-ml-2"
                  data-testid="profiler-header">
                  {t('label.related-term-plural')}
                </Typography.Text>
              </div>
            </Col>
            <Col span={24}>
              <RelatedTerms
                glossaryTerm={entityDetails as GlossaryTerm}
                permissions={glossaryTermPermission}
                onGlossaryTermUpdate={onGlossaryTermUpdate}
              />
            </Col>
          </Row>

          <Divider className="m-y-xs" />

          <Row className="m-y-md" gutter={[0, 8]}>
            <Col span={24}>
              <GlossaryTermReferences
                glossaryTerm={entityDetails as GlossaryTerm}
                permissions={glossaryTermPermission}
                onGlossaryTermUpdate={onGlossaryTermUpdate}
              />
            </Col>
          </Row>

          <Divider className="m-y-xs" />
        </>
      )}
    </Card>
  );
};

export default GlossaryRightPanel;
