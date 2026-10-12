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
import { Box, Grid, Owner, Typography } from '@openmetadata/ui-core-components';
import { Button } from 'antd';
import classNames from 'classnames';
import { toString } from 'lodash';
import { useMemo, type FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as VersionIcon } from '../../../assets/svg/ic-version.svg';
import BlockEditor from '../../../components/BlockEditor/BlockEditor';
import Loader from '../../../components/common/Loader/Loader';
import TagsContainerV2 from '../../../components/Tag/TagsContainerV2/TagsContainerV2';
import { LayoutType } from '../../../components/Tag/TagsViewer/TagsViewer.interface';
import { EntityField } from '../../../constants/Feeds.constants';
import { TagSource } from '../../../generated/type/tagLabel';
import type { KnowledgePage } from '../../../interface/knowledge-center.interface';
import { getLayoutGutter } from '../../../utils/common/layout.utils';
import contextCenterClassBase from '../../../utils/ContextCenterClassBase';
import { formatDate } from '../../../utils/date-time/DateTimeUtils';
import {
  getChangedEntityNewValue,
  getChangedEntityOldValue,
  getDiffByFieldName,
} from '../../../utils/EntityDiffPureUtils';
import { getRichTextDiff } from '../../../utils/EntityDiffUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { renderHighlightedText } from '../../../utils/EntitySearchUtils';
import type { VersionEntityTypes } from '../../../utils/EntityVersionUtils.interface';
import {
  getCommonExtraInfoForVersionDetails,
  getEntityVersionByField,
  getEntityVersionTags,
} from '../../../utils/EntityVersionUtilsPure';
import { getFrontEndFormat } from '../../../utils/FeedUtilsPure';
import i18n from '../../../utils/i18next/LocalUtil';
import { toOwnerRefs } from '../../../utils/Owner/ownerConversionUtils';

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
    const fieldDiff = getDiffByFieldName(
      EntityField.DESCRIPTION,
      knowledgePage.changeDescription ?? {}
    );
    const oldField = getFrontEndFormat(
      toString(getChangedEntityOldValue(fieldDiff))
    );
    const newField = getFrontEndFormat(
      toString(getChangedEntityNewValue(fieldDiff))
    );

    return getRichTextDiff(oldField, newField, knowledgePage.description);
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
    <Grid
      className="layout-row layout-grid knowledge-version-page-container"
      style={{ ...getLayoutGutter(0, 32) }}>
      <Grid.Item className="layout-column" span={24}>
        <Box
          className="layout-row"
          justify="between"
          style={{ ...getLayoutGutter(16, 16) }}
          wrap="nowrap">
          <Box
            className="layout-column tw:block m-r-md knowledge-version-title-col"
            style={{ flex: 'auto' }}>
            <Box
              inline
              align="stretch"
              className="layout-space w-full"
              direction="col"
              gap={8}
              itemClassName="layout-space-item">
              <Typography
                className="m-b-0 d-block entity-header-display-name text-lg font-semibold"
                data-testid="entity-header-display-name">
                {renderHighlightedText(displayName || knowledgePage.name)}
              </Typography>
              <Box
                align="center"
                className="layout-row"
                style={{ ...getLayoutGutter(16, 16) }}
                wrap="wrap">
                <Box className="layout-column tw:block">
                  <Box
                    inline
                    align="center"
                    className="layout-space layout-space-horizontal"
                    gap={1}
                    itemClassName="layout-space-item">
                    <Box
                      inline
                      align="stretch"
                      className="layout-space"
                      direction="col"
                      gap={0}
                      itemClassName="layout-space-item">
                      <Owner
                        isCompactView={false}
                        ownerDisplayName={ownerDisplayName}
                        owners={toOwnerRefs(
                          knowledgePage?.owners ?? ownerRef ?? []
                        )}
                        showLabel={false}
                      />
                      <span
                        className="self-center text-grey-muted"
                        data-testid="updated-at">
                        {formatDate(knowledgePage.updatedAt)}
                      </span>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>
          <Box className="layout-column tw:block" style={{ flex: 'none' }}>
            <Button
              className={classNames('', {
                'text-primary border-primary': version,
              })}
              data-testid="version-button"
              icon={<Icon component={VersionIcon} />}
              onClick={handleVersionClick}>
              <Typography
                className={classNames('', {
                  'text-primary': version,
                })}>
                {toString(version)}
              </Typography>
            </Button>
          </Box>
        </Box>
      </Grid.Item>
      <Grid.Item className="layout-column" span={24}>
        <Grid
          className="layout-row layout-grid"
          style={{ ...getLayoutGutter(0, 16) }}>
          <Grid.Item className="layout-column" span={24}>
            <Box
              inline
              align="center"
              className="layout-space layout-space-horizontal w-full knowledge-page-tags"
              gap={2}
              itemClassName="layout-space-item">
              <Typography color="secondary">
                {`${t('label.tag-plural')}:`}
              </Typography>
              <TagsContainerV2
                layoutType={LayoutType.HORIZONTAL}
                permission={false}
                selectedTags={tags}
                showTaskHandler={false}
                tagType={TagSource.Classification}
              />
            </Box>
          </Grid.Item>
          <Grid.Item className="layout-column" span={24}>
            <Box
              inline
              align="center"
              className="layout-space layout-space-horizontal w-full knowledge-page-tags"
              gap={2}
              itemClassName="layout-space-item">
              <Typography color="secondary">
                {`${t('label.glossary-term-plural')}:`}
              </Typography>
              <TagsContainerV2
                layoutType={LayoutType.HORIZONTAL}
                permission={false}
                selectedTags={tags}
                showTaskHandler={false}
                tagType={TagSource.Glossary}
              />
            </Box>
          </Grid.Item>
        </Grid>
      </Grid.Item>
      <Grid.Item className="layout-column m-b-md" span={24}>
        <BlockEditor content={descriptionDiff} editable={false} />
      </Grid.Item>
    </Grid>
  );
};

export default KnowledgePageVersion;
