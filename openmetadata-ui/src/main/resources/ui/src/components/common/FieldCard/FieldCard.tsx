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
import {
  BadgeWithIcon,
  Button,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { startCase } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ClassificationIcon } from '../../../assets/svg/classification.svg';
import { ReactComponent as GlossaryIcon } from '../../../assets/svg/glossary.svg';
import { TagSource } from '../../../generated/tests/testCase';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getDataTypeString } from '../../../utils/TablePureUtils';
import { prepareConstraintIcon } from '../../../utils/TableUtils';
import RichTextEditorPreviewerV1 from '../RichTextEditor/RichTextEditorPreviewerV1';
import { FieldCardProps } from './FieldCard.interface';

const FieldCard: React.FC<FieldCardProps> = ({
  fieldName,
  dataType,
  description,
  tags = [],
  columnConstraint,
  tableConstraints,
  isHighlighted = false,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [shouldShowButton, setShouldShowButton] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);
  const [showAllTerms, setShowAllTerms] = useState(false);
  const [visibleTagsCount, setVisibleTagsCount] = useState<number | null>(null);
  const [visibleTermsCount, setVisibleTermsCount] = useState<number | null>(
    null
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const tagsContainerRef = useRef<HTMLDivElement>(null);
  const termsContainerRef = useRef<HTMLDivElement>(null);
  const cachedTagsCount = useRef<number | null>(null);
  const cachedTermsCount = useRef<number | null>(null);

  const glossaryTerms = useMemo(
    () => tags.filter((tag) => tag.source === TagSource.Glossary),
    [tags]
  );

  const nonGlossaryTags = useMemo(
    () => tags.filter((tag) => tag.source !== TagSource.Glossary),
    [tags]
  );

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const checkIfTextIsTruncated = useCallback(() => {
    if (containerRef.current) {
      const element = containerRef.current;
      const markdownParser = element.querySelector('.markdown-parser');
      const measureNode = (markdownParser as HTMLElement) || element;
      const isVisible = measureNode.getClientRects().length > 0;
      if (!isVisible) {
        return;
      }
      const isTruncated =
        measureNode.scrollHeight > measureNode.clientHeight + 1;
      setShouldShowButton(isTruncated);
    }
  }, []);

  useEffect(() => {
    if (!description) {
      return;
    }

    setIsExpanded(false);
    setShouldShowButton(false);

    const id = setTimeout(checkIfTextIsTruncated, 100);

    return () => clearTimeout(id);
  }, [description, checkIfTextIsTruncated]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => {
      checkIfTextIsTruncated();
    });
    observer.observe(node);

    return () => observer.disconnect();
  }, [checkIfTextIsTruncated]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          checkIfTextIsTruncated();
        }
      }
    });
    io.observe(node);

    return () => io.disconnect();
  }, [checkIfTextIsTruncated]);

  const calculateVisibleItems = useCallback(
    (containerRef: React.RefObject<HTMLDivElement>, itemsCount: number) => {
      if (!containerRef.current || itemsCount === 0) {
        return itemsCount;
      }

      const container = containerRef.current;
      const items = Array.from(
        container.querySelectorAll('.tag-item, .glossary-term-item')
      ) as HTMLElement[];

      if (items.length === 0) {
        return itemsCount;
      }

      // Find first line baseline
      const firstItemTop = items[0].offsetTop;
      let visibleCount = 0;

      // Count items on the first line
      for (const item of items) {
        if (item.offsetTop === firstItemTop) {
          visibleCount++;
        } else {
          // Item wrapped to second line
          break;
        }
      }

      // If all items fit on one line, return all
      if (visibleCount === items.length) {
        return items.length;
      }

      // Otherwise, reserve space for "+X more" button by reducing count by 1
      return Math.max(1, visibleCount - 1);
    },
    []
  );

  useEffect(() => {
    if (nonGlossaryTags.length === 0 || showAllTags) {
      setVisibleTagsCount(null);

      return;
    }

    // If we have cached count and just collapsed, use it immediately
    if (cachedTagsCount.current !== null && !showAllTags) {
      setVisibleTagsCount(cachedTagsCount.current);

      return;
    }

    const calculateTags = () => {
      const count = calculateVisibleItems(
        tagsContainerRef,
        nonGlossaryTags.length
      );

      cachedTagsCount.current = count;
      setVisibleTagsCount(count);
    };

    // Calculate after render
    const timeout = setTimeout(calculateTags, 100);

    return () => clearTimeout(timeout);
  }, [nonGlossaryTags, showAllTags, calculateVisibleItems]);

  useEffect(() => {
    if (glossaryTerms.length === 0 || showAllTerms) {
      setVisibleTermsCount(null);

      return;
    }

    // If we have cached count and just collapsed, use it immediately
    if (cachedTermsCount.current !== null && !showAllTerms) {
      setVisibleTermsCount(cachedTermsCount.current);

      return;
    }

    const calculateTerms = () => {
      const count = calculateVisibleItems(
        termsContainerRef,
        glossaryTerms.length
      );

      cachedTermsCount.current = count;
      setVisibleTermsCount(count);
    };

    // Calculate after render
    const timeout = setTimeout(calculateTerms, 100);

    return () => clearTimeout(timeout);
  }, [glossaryTerms, showAllTerms, calculateVisibleItems]);

  const dataTypeDisplay = useMemo(
    () => getDataTypeString(startCase(dataType)),
    [dataType]
  );

  const constraintIcon = useMemo(
    () =>
      columnConstraint
        ? prepareConstraintIcon({
            columnName: fieldName,
            columnConstraint,
            tableConstraints,
            iconClassName: 'm-r-xss',
            iconWidth: '14px',
          })
        : null,
    [columnConstraint, fieldName, tableConstraints]
  );

  const visibleTags = useMemo(
    () =>
      showAllTags || visibleTagsCount === null
        ? nonGlossaryTags
        : nonGlossaryTags.slice(0, visibleTagsCount),
    [showAllTags, visibleTagsCount, nonGlossaryTags]
  );

  const visibleTerms = useMemo(
    () =>
      showAllTerms || visibleTermsCount === null
        ? glossaryTerms
        : glossaryTerms.slice(0, visibleTermsCount),
    [showAllTerms, visibleTermsCount, glossaryTerms]
  );

  const tagsMoreLabel = useMemo(
    () =>
      visibleTagsCount === null
        ? ''
        : `+${nonGlossaryTags.length - visibleTagsCount} ${t(
            'label.more-lowercase'
          )}`,
    [visibleTagsCount, nonGlossaryTags.length, t]
  );

  const termsMoreLabel = useMemo(
    () =>
      visibleTermsCount === null
        ? ''
        : `+${glossaryTerms.length - visibleTermsCount} ${t(
            'label.more-lowercase'
          )}`,
    [visibleTermsCount, glossaryTerms.length, t]
  );

  const handleShowAllTags = useCallback(() => setShowAllTags(true), []);
  const handleHideAllTags = useCallback(() => setShowAllTags(false), []);
  const handleShowAllTerms = useCallback(() => setShowAllTerms(true), []);
  const handleHideAllTerms = useCallback(() => setShowAllTerms(false), []);

  return (
    <div
      className={classNames(
        'field-card tw:border-b-[0.6px] tw:border-solid tw:border-secondary',
        'tw:px-4 tw:pt-4 tw:pb-2 tw:max-md:p-3 tw:max-md:mb-2',
        { 'field-card-highlighted': isHighlighted }
      )}
      data-testid={`field-card-${fieldName}`}>
      <div className="field-card-header" data-testid="field-card-header">
        <div className="field-card-name tw:flex tw:flex-1 tw:items-center tw:max-md:w-full">
          {constraintIcon && (
            <span className="tw:mr-2 tw:flex tw:items-center">
              {constraintIcon}
            </span>
          )}
          <Typography
            as="div"
            className="not-prose tw:mb-1 tw:break-words tw:text-[13px] tw:font-semibold tw:text-primary"
            data-testid={`field-name-${fieldName}`}>
            {fieldName}
          </Typography>
        </div>
        <Typography
          as="div"
          className="not-prose tw:mb-2 tw:text-xs tw:font-normal tw:leading-[19px] tw:text-secondary"
          data-testid={`data-type-text-${dataType}`}>
          {startCase(dataTypeDisplay)}
        </Typography>
      </div>

      <div
        className="field-card-content tw:flex tw:flex-col"
        data-testid="field-card-content">
        <Typography
          as="div"
          className={classNames(
            'not-prose tw:text-[13px] tw:font-normal tw:text-secondary',
            'tw:[&_.block-editor-wrapper_.tiptap.ProseMirror]:text-[13px]!'
          )}
          data-testid={`field-description-${fieldName}`}>
          {description ? (
            <div>
              <div
                className={classNames(
                  isExpanded
                    ? 'tw:block tw:leading-[1.4]'
                    : 'tw:[&_.markdown-parser]:line-clamp-3 tw:[&_.markdown-parser]:break-words tw:[&_.markdown-parser]:text-[13px] tw:[&_.markdown-parser]:leading-[18px]'
                )}
                ref={containerRef}>
                <RichTextEditorPreviewerV1
                  enableSeeMoreVariant={false}
                  isDescriptionExpanded={isExpanded}
                  markdown={description}
                />
              </div>
              {(shouldShowButton || isExpanded) && (
                <Button
                  className="tw:mt-1"
                  color="link-color"
                  size="xs"
                  onClick={toggleExpanded}>
                  {isExpanded ? t('label.show-less') : t('label.show-more')}
                </Button>
              )}
            </div>
          ) : (
            <Typography as="span" className="tw:text-secondary">
              {t('label.no-entity', { entity: t('label.description') })}
            </Typography>
          )}
        </Typography>

        <div className="tw:mt-3 tw:mb-2 tw:flex tw:flex-col tw:gap-2">
          {nonGlossaryTags.length > 0 && (
            <div
              className={classNames(
                'metadata-section tw:flex tw:items-start tw:gap-2',
                showAllTags ? 'tw:flex-col' : 'tw:flex-row'
              )}>
              <Typography
                as="span"
                className="tw:text-xs tw:font-medium tw:leading-5 tw:whitespace-nowrap tw:text-secondary">
                {t('label.-with-colon', { text: t('label.tag-plural') })}
              </Typography>
              <div className="tw:min-w-0 tw:flex-1">
                <div
                  className="tw:flex tw:flex-wrap tw:items-center tw:gap-1.5"
                  ref={tagsContainerRef}>
                  {visibleTags.map((tag) => (
                    <span
                      className="tag-item"
                      data-testid={`tag-${tag.tagFQN}`}
                      key={tag.tagFQN}>
                      <BadgeWithIcon
                        color="gray"
                        iconLeading={ClassificationIcon}
                        size="xs"
                        type="color">
                        {getEntityName(tag)}
                      </BadgeWithIcon>
                    </span>
                  ))}
                  {visibleTagsCount !== null &&
                    nonGlossaryTags.length > visibleTagsCount &&
                    !showAllTags && (
                      <Button
                        className="show-more-tags-button tw:whitespace-nowrap"
                        color="link-color"
                        size="xs"
                        onClick={handleShowAllTags}>
                        {tagsMoreLabel}
                      </Button>
                    )}
                  {showAllTags && nonGlossaryTags.length > 1 && (
                    <Button
                      className="show-more-tags-button tw:whitespace-nowrap"
                      color="link-color"
                      size="xs"
                      onClick={handleHideAllTags}>
                      {t('label.less')}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
          {glossaryTerms.length > 0 && (
            <div
              className={classNames(
                'metadata-section tw:flex tw:items-start tw:gap-2',
                showAllTerms ? 'tw:flex-col' : 'tw:flex-row'
              )}>
              <Typography
                as="span"
                className="tw:text-xs tw:font-medium tw:leading-5 tw:whitespace-nowrap tw:text-secondary">
                {t('label.-with-colon', {
                  text: t('label.glossary-term-plural'),
                })}
              </Typography>
              <div className="tw:min-w-0 tw:flex-1">
                <div
                  className="tw:flex tw:flex-wrap tw:items-center tw:gap-1.5"
                  ref={termsContainerRef}>
                  {visibleTerms.map((glossaryTerm) => (
                    <span
                      className="glossary-term-item"
                      data-testid={`term-${glossaryTerm.tagFQN}`}
                      key={glossaryTerm.tagFQN}>
                      <BadgeWithIcon
                        color="gray"
                        iconLeading={GlossaryIcon}
                        size="xs"
                        type="color">
                        {getEntityName(glossaryTerm)}
                      </BadgeWithIcon>
                    </span>
                  ))}
                  {visibleTermsCount !== null &&
                    glossaryTerms.length > visibleTermsCount &&
                    !showAllTerms && (
                      <Button
                        className="show-more-terms-button tw:whitespace-nowrap"
                        color="link-color"
                        size="xs"
                        onClick={handleShowAllTerms}>
                        {termsMoreLabel}
                      </Button>
                    )}
                  {showAllTerms && glossaryTerms.length > 1 && (
                    <Button
                      className="show-more-terms-button tw:whitespace-nowrap"
                      color="link-color"
                      size="xs"
                      onClick={handleHideAllTerms}>
                      {t('label.less')}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FieldCard;
