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

import { Button, Tooltip, Typography } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { FC, useCallback, useMemo, useState } from 'react';
import { Focusable } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';
import { useEntityRules } from '../../../hooks/useEntityRules';
import { activateOnEnterOrSpace } from '../../../utils/InteractiveTargetUtils';
import { getTagRedirectLink } from '../../../utils/TagsPureUtils';
import { getTagTooltip } from '../../../utils/TagsUtils';
import Tag from '../../common/atoms/Tag/Tag';
import { GlossaryTermSelectableList } from '../../common/GlossaryTermSelectableList/GlossaryTermSelectableList.component';
import { GlossaryTermsProps } from './GlossaryTerms.interface';

const DEFAULT_SIZE_CAP = 3;

const GlossaryTerms: FC<GlossaryTermsProps> = ({
  terms = [],
  mode = 'display',
  onSelectionChange,
  sizeCap = DEFAULT_SIZE_CAP,
  showNoDataPlaceholder = true,
  permission = false,
  entityType,
  className,
}) => {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const { entityRules } = useEntityRules(entityType!);

  const glossaryTerms = useMemo(
    () => terms.filter((tag) => tag.source === TagSource.Glossary),
    [terms]
  );

  const visibleTerms = useMemo(
    () =>
      showAll || sizeCap < 0
        ? glossaryTerms
        : glossaryTerms.slice(0, sizeCap),
    [glossaryTerms, sizeCap, showAll]
  );

  const overflowCount = useMemo(
    () => (sizeCap >= 0 ? Math.max(0, glossaryTerms.length - sizeCap) : 0),
    [glossaryTerms, sizeCap]
  );

  const handleUpdate = useCallback(
    async (selectedTerms: TagLabel[]) => {
      await onSelectionChange?.(selectedTerms);
      setPopoverOpen(false);
    },
    [onSelectionChange]
  );

  const handleCancel = useCallback(() => {
    setPopoverOpen(false);
  }, []);

  const renderChip = useCallback((term: TagLabel) => {
    const label =
      term.displayName ||
      term.name ||
      term.tagFQN.split('.').slice(-2).join('.');
    const redirectLink = getTagRedirectLink(term);

    return (
      <Tooltip
        arrow
        delay={500}
        key={term.tagFQN}
        placement="top"
        title={getTagTooltip(term.tagFQN, term.description) ?? ''}>
        <Focusable>
          <Link
            className="tw:no-underline"
            data-testid="glossary-tag-redirect-link"
            to={redirectLink}>
            <Tag
              data-testid="glossary-term-tag"
              label={label}
              size="sm"
              variant="glossary"
            />
          </Link>
        </Focusable>
      </Tooltip>
    );
  }, []);

  if (mode === 'selector') {
    return (
      <div
        className={classNames('w-full', className)}
        data-testid="glossary-terms-selector">
        <div className="d-flex flex-wrap gap-2 align-center">
          {glossaryTerms.map(renderChip)}
          {permission && (
            <GlossaryTermSelectableList
              multiSelect={entityRules?.canAddMultipleGlossaryTerm ?? true}
              popoverProps={{
                placement: 'bottomLeft',
                open: popoverOpen,
                onOpenChange: setPopoverOpen,
              }}
              selectedTerms={glossaryTerms}
              onCancel={handleCancel}
              onUpdate={handleUpdate}>
              <button
                className="tw:text-xs tw:text-primary tw:bg-transparent tw:border tw:border-dashed tw:border-primary tw:rounded-lg tw:px-2 tw:py-0.5 tw:cursor-pointer tw:h-[24px]"
                data-testid="add-glossary-term"
                tabIndex={0}
                onClick={() => setPopoverOpen(true)}
                onKeyDown={activateOnEnterOrSpace}>
                {isEmpty(glossaryTerms)
                  ? t('label.add-entity', {
                      entity: t('label.glossary-term'),
                    })
                  : t('label.edit-entity', {
                      entity: t('label.glossary-term'),
                    })}
              </button>
            </GlossaryTermSelectableList>
          )}
          {isEmpty(glossaryTerms) && !permission && showNoDataPlaceholder && (
            <Typography className="tw:text-tertiary" size="text-sm">
              {NO_DATA_PLACEHOLDER}
            </Typography>
          )}
        </div>
      </div>
    );
  }

  if (isEmpty(glossaryTerms) && showNoDataPlaceholder) {
    return (
      <Typography className="tw:text-tertiary" size="text-sm">
        {NO_DATA_PLACEHOLDER}
      </Typography>
    );
  }

  return (
    <div
      className={classNames('d-flex flex-wrap gap-2', className)}
      data-testid="glossary-terms-viewer">
      {visibleTerms.map(renderChip)}
      {overflowCount > 0 && (
        <Button
          color="link-color"
          data-testid="glossary-terms-read-more"
          size="sm"
          onClick={() => setShowAll((prev) => !prev)}>
          {showAll
            ? t('label.less')
            : t('label.plus-count-more', { count: overflowCount })}
        </Button>
      )}
    </div>
  );
};

export default GlossaryTerms;
