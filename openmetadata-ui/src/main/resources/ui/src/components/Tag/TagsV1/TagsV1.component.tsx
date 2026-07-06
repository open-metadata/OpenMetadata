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
import {
  Badge,
  Tooltip,
  TooltipTrigger,
  Typography
} from '@openmetadata/ui-core-components';
import { Tag } from 'antd';
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
import { reduceColorOpacity } from '../../../utils/ColorUtils';
import EntityLink from '../../../utils/EntityLink';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { renderIcon } from '../../../utils/IconUtils';
import {
  getClassificationTagPath,
  getGlossaryPath,
} from '../../../utils/RouterUtils';
import tagClassBase from '../../../utils/TagClassBase';
import { getTagDisplay } from '../../../utils/TagsPureUtils';
import { getTagTooltip } from '../../../utils/TagsUtils';
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
  entityFqn,
}: TagsV1Props) => {
  const color = useMemo(
    () => (isVersionPage ? undefined : tag.style?.color),
    [isVersionPage, tag]
  );

  const isGlossaryTag = useMemo(
    () => tag.source === TagSource.Glossary,
    [tag.source]
  );

  const startIcon = useMemo(() => {
    if (newLook && !isGlossaryTag) {
      return (
        <IconTagNew
          className="tw:shrink-0 m-r-xss"
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
          className="tw:shrink-0 m-r-xss"
          data-testid="glossary-icon"
          height={12}
          name="glossary-icon"
          width={12}
        />
      );
    }

    return (
      <IconTag
        className="tw:shrink-0 m-r-xss"
        data-testid="tags-icon"
        height={12}
        name="tag-icon"
        width={12}
      />
    );
  }, [isGlossaryTag, newLook]);

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
          <Typography
            ellipsis
            className="tags-label"
            data-testid={`tag-${tag.tagFQN}`}
            style={{ color: tag.style?.color }}>
            {tagName}
          </Typography>
        </div>
      </div>
    ),
    [renderTagIcon, tagName, tag, tagColorBar, tagChipStyleClass]
  );

  const automatedTagChip = useMemo(
    () => (
      <Link
        className="no-underline"
        data-testid="tag-redirect-link"
        to={redirectLink}>
        <Badge
          className="tw:cursor-pointer tw:text-utility-brand-700 tw:ring-utility-brand-100 tw:bg-utility-brand-50 hover:tw:bg-utility-brand-50"
          color="brand"
          size="sm"
          type="color">
          <span className="tw:flex tw:items-center tw:gap-1">
            <AutomatedTag
              className="tw:text-utility-brand-900 tw:shrink-0"
              width={16}
            />
            <span
              className="tw:text-utility-brand-900"
              data-testid={`tag-${tag.tagFQN}`}>
              {tagName}
            </span>
          </span>
        </Badge>
      </Link>
    ),
    [tagName, tag.tagFQN, redirectLink]
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
    [
      className,
      color,
      size,
      tag,
      tagChipStyleClass,
      tagContent,
      tagProps,
      redirectLink,
    ]
  );

  const addTagChip = useMemo(
    () => (
       <Tag
        className="tag-chip tag-chip-add-button"
        icon={<PlusIcon height={16} name="plus" width={16} />}>
       <Typography
          ellipsis
          className="m-0"
          data-testid="add-tag"
          size="text-xs"
          weight="medium">
          {getTagDisplay(tagName)}
        </Typography>
      </Tag>
    ),
    [tagName]
  );

  if (startWith === TAG_START_WITH.PLUS) {
    return addTagChip;
  }
  if (tag.labelType === LabelType.Generated && entityFqn) {
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
        entityFqn,
        automatedTagChip
      );

      if (recognizerPopupWrapper) {
        return recognizerPopupWrapper;
      }
    }

    return (
      <Tooltip
        arrow
        placement="top"
        title={tooltipOverride ?? getTagTooltip(tag.tagFQN, tag.description)}>
        <TooltipTrigger>
           {automatedTagChip}
        </TooltipTrigger>
      </Tooltip>
    );
  }

  return isEditTags ? (
    tagChip
  ) : (
    <Tooltip
      arrow
      placement="top"
      title={tooltipOverride ?? getTagTooltip(tag.tagFQN, tag.description)}>
        <TooltipTrigger>
          {tagChip}
        </TooltipTrigger>
    </Tooltip>
  );
};

export default TagsV1;
