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
import ProfilePicture from 'components/common/ProfilePicture/ProfilePicture';
import TagsViewer from 'components/Tag/TagsViewer/tags-viewer';
import { getUserPath } from 'constants/constants';
import { Glossary } from 'generated/entity/data/glossary';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getEntityName } from 'utils/EntityUtils';
import SVGIcons from 'utils/SvgUtils';

interface GlossaryRightPanelProps {
  glossary: Glossary;
}

const GlossaryRightPanel = ({ glossary }: GlossaryRightPanelProps) => {
  const { t } = useTranslation();
  console.log(glossary);
  if (!glossary) {
    return null;
  }

  return (
    <Card
      className="right-panel-card tw-h-full page-layout-v1-right-panel page-layout-v1-vertical-scroll"
      data-testid="glossary-right-panel">
      <Typography.Title className="m-0" level={5}>
        {t('label.summary')}
      </Typography.Title>

      {/* <Row className="m-md" gutter={[0, 16]}>
        <Col span={24}>
          <Typography.Text
            className="text-base text-grey-muted"
            data-testid="profiler-header">
             {t('label.glossary-name')}
          </Typography.Text>
        </Col>
        <Col span={24}></Col>
      </Row>

      <Divider className="m-y-xs" /> */}

      <Row className="m-y-md">
        <Col span={24}>
          <Typography.Text
            className="text-grey-muted"
            data-testid="profiler-header">
            {t('label.glossary-name')}
          </Typography.Text>
        </Col>
        <Col span={24}>{glossary.displayName}</Col>
      </Row>

      <Divider className="m-y-xs" />

      <Row className="m-y-md" gutter={[0, 8]}>
        <Col span={24}>
          <Typography.Text
            className="text-grey-muted"
            data-testid="profiler-header">
            {t('label.reviewer-plural')}
          </Typography.Text>
        </Col>
        <Col span={24}>
          {glossary.reviewers && glossary.reviewers.length ? (
            <>
              {glossary.reviewers.map((reviewer) => (
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
                    {/* <Tooltip
                      title={
                        permissions.EditAll
                          ? 'Remove Reviewer'
                          : NO_PERMISSION_FOR_ACTION
                      }>
                      <Button
                        className="p-0 flex-center"
                        data-testid="remove"
                        disabled={!permissions.EditAll}
                        icon={<CloseOutlined />}
                        size="small"
                        type="text"
                        onClick={() => handleRemoveReviewer(reviewer.id)}
                      />
                    </Tooltip> */}
                  </Space>
                </Space>
              ))}
            </>
          ) : (
            <span className="text-grey-muted">
              {t('label.no-entity', {
                entity: t('label.reviewer-plural'),
              })}
            </span>
          )}
        </Col>
      </Row>

      <Divider className="m-y-xs" />

      <Row className="m-y-md" gutter={[0, 16]}>
        <Col span={24}>
          <Typography.Text
            className="text-grey-muted"
            data-testid="profiler-header">
            {t('label.tag-plural')}
          </Typography.Text>
        </Col>
        <Col span={24}>
          {glossary?.tags && glossary.tags.length > 0 && (
            <>
              <SVGIcons
                alt="icon-tag"
                className="tw-mx-1"
                icon="icon-tag-grey"
                width="16"
              />
              <TagsViewer tags={glossary.tags} />
            </>
          )}
        </Col>
      </Row>

      <Divider className="m-y-xs" />

      <Row className="m-y-md" gutter={[0, 16]}>
        <Col span={24}>
          <Typography.Text
            className="text-grey-muted"
            data-testid="profiler-header">
            {t('label.synonym-plural')}
          </Typography.Text>
        </Col>
        <Col span={24} />
      </Row>

      <Divider className="m-y-xs" />

      <Row className="m-y-md" gutter={[0, 16]}>
        <Col span={24}>
          <Typography.Text
            className="text-grey-muted"
            data-testid="profiler-header">
            {t('label.related-term-plural')}
          </Typography.Text>
        </Col>
        <Col span={24} />
      </Row>

      <Divider className="m-y-xs" />

      <Row className="m-y-md" gutter={[0, 16]}>
        <Col span={24}>
          <Typography.Text
            className="text-grey-muted"
            data-testid="profiler-header">
            {t('label.reference-plural')}
          </Typography.Text>
        </Col>
        <Col span={24} />
      </Row>

      <Divider className="m-y-xs" />
    </Card>
  );
};

export default GlossaryRightPanel;
