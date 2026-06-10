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
import Icon from '@ant-design/icons';
import { Button, Col, Row, Space, Typography } from 'antd';
import classNames from 'classnames';
import { diffWordsWithSpace } from 'diff';
import { isEmpty, map, toString } from 'lodash';
import { useMemo, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as VersionIcon } from '../../../assets/svg/ic-version.svg';
import BlockEditor from '../../../components/BlockEditor/BlockEditor';
import Loader from '../../../components/common/Loader/Loader';
import { OwnerLabel } from '../../../components/common/OwnerLabel/OwnerLabel.component';
import TagsContainerV2 from '../../../components/Tag/TagsContainerV2/TagsContainerV2';
import { LayoutType } from '../../../components/Tag/TagsViewer/TagsViewer.interface';
import { EntityField } from '../../../constants/Feeds.constants';
import { TagSource } from '../../../generated/type/tagLabel';
import type { KnowledgePage } from '../../../interface/knowledge-center.interface';
import contextCenterClassBase from '../../../utils/ContextCenterClassBase';
import { formatDate } from '../../../utils/date-time/DateTimeUtils';
import {
  getChangedEntityNewValue,
  getChangedEntityOldValue,
  getDiffByFieldName,
} from '../../../utils/EntityDiffPureUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import type { VersionEntityTypes } from '../../../utils/EntityVersionUtils.interface';
import {
  getCommonExtraInfoForVersionDetails,
  getEntityVersionByField,
  getEntityVersionTags,
} from '../../../utils/EntityVersionUtilsPure';
import { getFrontEndFormat } from '../../../utils/FeedUtils';
import i18n from '../../../utils/i18next/LocalUtil';
import { stringToHTML } from '../../../utils/StringUtils';

interface KnowledgePageVersionProps {
  knowledgePage: KnowledgePage;
  loading: boolean;
}

const KnowledgePageVersion: FC<KnowledgePageVersionProps> = ({
  knowledgePage,
  loading,
}) => {
  const { t } = i18n;
  const navigate = useNavigate();
  const { version } = useMemo(
    () => ({
      entityName: getEntityName(knowledgePage),
      version: knowledgePage.version,
    }),
    [knowledgePage]
  );

  const descriptionDiff = useMemo(() => {
    const changeDescription = knowledgePage.changeDescription ?? {};
    const currentDescription = knowledgePage.description;

    const fieldDiff = getDiffByFieldName(
      EntityField.DESCRIPTION,
      changeDescription
    );

    const oldField = getFrontEndFormat(
      toString(getChangedEntityOldValue(fieldDiff))
    );
    const newField = getFrontEndFormat(
      toString(getChangedEntityNewValue(fieldDiff))
    );

    if (isEmpty(newField) && isEmpty(oldField)) {
      return currentDescription;
    }

    const diffArr = diffWordsWithSpace(oldField, newField);

    const result = map(diffArr, (diff) => {
      const value = diff.value.trim().replaceAll('\n', '<br>');

      if (diff.added && value) {
        return `<diff-view class="diff-added">${value}</diff-view>`;
      }
      if (diff.removed && value) {
        return `<diff-view class="diff-removed">${value}</diff-view>`;
      }

      if (value) {
        return `<diff-view>${value}</diff-view>`;
      }

      return '';
    });

    return result.join('');
  }, [knowledgePage]);

  const tags = useMemo(() => {
    return getEntityVersionTags(
      knowledgePage as VersionEntityTypes,
      knowledgePage.changeDescription ?? {}
    );
  }, [knowledgePage]);

  const displayName = useMemo(() => {
    return getEntityVersionByField(
      knowledgePage.changeDescription ?? {},
      EntityField.DISPLAYNAME,
      knowledgePage.displayName
    );
  }, [knowledgePage]);

  const { ownerDisplayName, ownerRef } = useMemo(
    () =>
      getCommonExtraInfoForVersionDetails(
        knowledgePage.changeDescription ?? {},
        knowledgePage.owners
      ),
    [knowledgePage]
  );

  const handleVersionClick = () => {
    navigate(
      contextCenterClassBase.getArticlePath(knowledgePage.fullyQualifiedName)
    );
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <Row className="knowledge-version-page-container" gutter={[0, 32]}>
      <Col span={18}>
        <Space direction="vertical" size={32}>
          <Typography.Text
            className="m-b-0 d-block entity-header-display-name text-lg font-semibold"
            data-testid="entity-header-display-name"
            ellipsis={{ tooltip: true }}>
            {stringToHTML(displayName || knowledgePage.name)}
          </Typography.Text>
          <Row align="middle" gutter={[16, 16]}>
            <Col>
              <Space size={4}>
                <Space direction="vertical" size={0}>
                  <OwnerLabel
                    ownerDisplayName={ownerDisplayName}
                    owners={knowledgePage?.owners ?? ownerRef}
                  />
                  <span
                    className="self-center text-grey-muted"
                    data-testid="updated-at">
                    {formatDate(knowledgePage.updatedAt)}
                  </span>
                </Space>
              </Space>
            </Col>
          </Row>
        </Space>
      </Col>
      <Col offset={2} span={2}>
        <Button
          className={classNames('', {
            'text-primary border-primary': version,
          })}
          data-testid="version-button"
          icon={<Icon component={VersionIcon} />}
          onClick={handleVersionClick}>
          <Typography.Text
            className={classNames('', {
              'text-primary': version,
            })}>
            {toString(version)}
          </Typography.Text>
        </Button>
      </Col>
      <Col span={24}>
        <Row gutter={[0, 16]}>
          <Col span={24}>
            <Space align="center" className="w-full knowledge-page-tags">
              <Typography.Text className="text-grey-muted">
                {`${t('label.tag-plural')}:`}
              </Typography.Text>
              <TagsContainerV2
                layoutType={LayoutType.HORIZONTAL}
                permission={false}
                selectedTags={tags}
                showTaskHandler={false}
                tagType={TagSource.Classification}
              />
            </Space>
          </Col>
          <Col span={24}>
            <Space align="center" className="w-full knowledge-page-tags">
              <Typography.Text className="text-grey-muted">
                {`${t('label.glossary-term-plural')}:`}
              </Typography.Text>
              <TagsContainerV2
                layoutType={LayoutType.HORIZONTAL}
                permission={false}
                selectedTags={tags}
                showTaskHandler={false}
                tagType={TagSource.Glossary}
              />
            </Space>
          </Col>
        </Row>
      </Col>
      <Col className="m-b-md" span={24}>
        <BlockEditor content={descriptionDiff} editable={false} />
      </Col>
    </Row>
  );
};

export default KnowledgePageVersion;
