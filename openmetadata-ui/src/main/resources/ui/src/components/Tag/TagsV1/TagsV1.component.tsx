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
import { useTheme } from '@mui/material';
import { Tag, Tooltip, Typography } from 'antd';
import classNames from 'classnames';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ReactComponent as AutomatedTag } from '../../../assets/svg/automated-tag.svg';
import { ReactComponent as IconTerm } from '../../../assets/svg/book.svg';
import { ReactComponent as IconTagNew } from '../../../assets/svg/ic-tag-new.svg';
import { ReactComponent as PlusIcon } from '../../../assets/svg/plus-primary.svg';
import { ReactComponent as IconTag } from '../../../assets/svg/tag.svg';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { TAG_START_WITH } from '../../../constants/Tag.constants';
import { LabelType, TagSource } from '../../../generated/type/tagLabel';
import { reduceColorOpacity } from '../../../utils/CommonUtils';
import EntityLink from '../../../utils/EntityLink';
import { getEntityName } from '../../../utils/EntityUtils';
import { renderIcon } from '../../../utils/IconUtils';
import {
  getClassificationTagPath,
  getGlossaryPath,
} from '../../../utils/RouterUtils';
import tagClassBase from '../../../utils/TagClassBase';
import { getTagDisplay, getTagTooltip } from '../../../utils/TagsUtils';
import TagChip from '../../common/atoms/TagChip/TagChip';
import { HighlightedTagLabel } from '../../Explore/EntitySummaryPanel/SummaryList/SummaryList.interface';
import { TagsV1Props } from './TagsV1.interface';
import './tagsV1.less';

const TagsV1 = ({
  hideIcon,
  tag,
  startWith,
  className,
  showOnlyName = false,
  isVersionPage = false,
  tagProps,
  tooltipOverride,
  tagType,
  size,
  isEditTags,
  newLook,
  entityType,
  entityFqn,
}: TagsV1Props) => {
  const theme = useTheme();
  const color = useMemo(
    () => (isVersionPage ? undefined : tag.style?.color),
    [tag]
  );

  const isGlossaryTag = useMemo(
    () => tag.source === TagSource.Glossary,
    [tag.source]
  );

  const startIcon = useMemo(() => {
    if (newLook && !isGlossaryTag) {
      return (
        <IconTagNew
          className="flex-shrink m-r-xss"
          data-testid="tags-icon"
          height={12}
          name="tag-icon"
          width={12}
        />
      );
    }
    if (isGlossaryTag) {
      return (
        <IconTerm
          className="flex-shrink m-r-xss"
          data-testid="glossary-icon"
          height={12}
          name="glossary-icon"
          width={12}
        />
      );
    } else {
      return (
        <IconTag
          className="flex-shrink m-r-xss"
          data-testid="tags-icon"
          height={12}
          name="tag-icon"
          width={12}
        />
      );
    }
  }, [isGlossaryTag]);

  const tagName = useMemo(
    () =>
      getEntityName(tag) ||
      getTagDisplay(
        showOnlyName
          ? tag.tagFQN
              .split(FQN_SEPARATOR_CHAR)
              .slice(-2)
              .join(FQN_SEPARATOR_CHAR)
          : tag.tagFQN
      ),
    [showOnlyName, tag]
  );

  const redirectLink = useMemo(
    () =>
      (tagType ?? tag.source) === TagSource.Glossary
        ? getGlossaryPath(tag.tagFQN)
        : getClassificationTagPath(tag.tagFQN),
    [tagType, tag.source, tag.tagFQN]
  );

  const tagColorBar = useMemo(
    () =>
      color ? (
        <div className="tag-color-bar" style={{ borderColor: color }} />
      ) : null,
    [color]
  );

  const tagChipStyleClass = useMemo(() => {
    if (newLook && !tag.style?.color) {
      return 'new-chip-style';
    }
    if (newLook && tag.style?.color) {
      return 'new-chip-style-with-color';
    }

    return '';
  }, [newLook, tag.style?.color]);

  const renderGeneratedTagIcon = useMemo(() => {
    if (tag.style?.iconURL) {
      return renderIcon(tag.style.iconURL, {
        size: 12,
        style: { marginRight: 4, flexShrink: 0 },
      });
    }

    return <AutomatedTag width={16} />;
  }, [tag.style?.iconURL]);

  const renderTagIcon = useMemo(() => {
    if (hideIcon) {
      return null;
    }

    if (tag.style?.iconURL) {
      return renderIcon(tag.style.iconURL, {
        size: 12,
        style: { marginRight: 4, flexShrink: 0 },
      });
    }

    return startIcon;
  }, [hideIcon, tag.style?.iconURL, startIcon]);

  const tagContent = useMemo(
    () => (
      <div className="d-flex w-full">
        {tagColorBar}
        <div
          className={classNames(
            'd-flex items-center p-x-xs w-full tag-content-container',
            tagChipStyleClass
          )}>
          {renderTagIcon}
          <Typography.Text
            className="m-0 tags-label text-truncate truncate w-max-full"
            data-testid={`tag-${tag.tagFQN}`}
            ellipsis={{ tooltip: false }}
            style={{ color: tag.style?.color }}>
            {tagName}
          </Typography.Text>
        </div>
      </div>
    ),
    [renderTagIcon, tagName, tag, tagColorBar]
  );

  const automatedTagChip = useMemo(
    () => (
      <Link
        className="no-underline"
        data-testid="tag-redirect-link"
        to={redirectLink}>
        <TagChip
          icon={renderGeneratedTagIcon}
          label={tag.displayName || tag.name || tagName || ''}
          labelDataTestId={`tag-${tag.tagFQN}`}
          sx={{
            pl: 1.5,
            color: theme.palette.allShades.brand[900],
            borderColor: theme.palette.allShades.brand[100],
            backgroundColor: theme.palette.allShades.brand[50],
            '&::before': {
              display: 'none',
            },
            '&:hover': {
              backgroundColor: theme.palette.allShades.brand[50],
            },
          }}
        />
      </Link>
    ),
    [tagName, tag, redirectLink, theme]
  );

  const tagChip = useMemo(
    () => (
      <Tag
        className={classNames(
          className,
          'tag-chip tag-chip-content',
          tagChipStyleClass,
          {
            'tag-highlight': Boolean(
              (tag as HighlightedTagLabel).isHighlighted
            ),
          },

          size,
          'cursor-pointer'
        )}
        data-testid="tags"
        style={
          color
            ? { backgroundColor: reduceColorOpacity(color, 0.05) }
            : undefined
        }
        {...tagProps}>
        {/* Wrap only content to avoid redirect on closeable icons  */}
        <Link
          className="no-underline h-full w-max-stretch"
          data-testid="tag-redirect-link"
          to={redirectLink}>
          {tagContent}
        </Link>
      </Tag>
    ),
    [color, tagContent, redirectLink]
  );

  const addTagChip = useMemo(
    () => (
      <Tag
        className="tag-chip tag-chip-add-button"
        icon={<PlusIcon height={16} name="plus" width={16} />}>
        <Typography.Text
          className="m-0 text-xs font-medium text-primary text-truncate truncate w-max-full"
          data-testid="add-tag"
          ellipsis={{ tooltip: false }}>
          {getTagDisplay(tagName)}
        </Typography.Text>
      </Tag>
    ),
    [tagName]
  );

  if (startWith === TAG_START_WITH.PLUS) {
    return addTagChip;
  }
  if (tag.labelType === LabelType.Generated && entityType && entityFqn) {
    if (isEditTags) {
      return automatedTagChip;
    }

    const columnName = EntityLink.getTableColumnNameFromColumnFqn(
      entityFqn,
      false
    );

    // Only show Collate feedback popup for column-level tags
    if (columnName) {
      const recognizerPopupWrapper = tagClassBase.getRecognizerFeedbackPopup(
        tag,
        entityType,
        entityFqn,
        automatedTagChip
      );

      if (recognizerPopupWrapper) {
        return recognizerPopupWrapper;
      }
    }

    return (
      <Tooltip
        mouseEnterDelay={0.5}
        placement="bottomLeft"
        title={tooltipOverride ?? getTagTooltip(tag.tagFQN, tag.description)}
        trigger="hover">
        {automatedTagChip}
      </Tooltip>
    );
  }

  return (
    <>
      {isEditTags ? (
        tagChip
      ) : (
        <Tooltip
          mouseEnterDelay={0.5}
          placement="bottomLeft"
          title={tooltipOverride ?? getTagTooltip(tag.tagFQN, tag.description)}
          trigger="hover">
          {tagChip}
        </Tooltip>
      )}
    </>
  );
};

export default TagsV1;
