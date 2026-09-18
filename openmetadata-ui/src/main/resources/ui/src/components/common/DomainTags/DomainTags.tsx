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
import { Button, DomainTag } from '@openmetadata/ui-core-components';
import { isEmpty } from 'lodash';
import { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getDomainPath } from '../../../utils/RouterUtils';
import { DomainTagsProps } from './DomainTags.types';

const DomainTags: FC<DomainTagsProps> = ({
  domains,
  onRemove,
  maxVisible = 5,
  size = 'sm',
  showInheritedIcon = true,
  className,
  'data-testid': dataTestId,
}) => {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);

  const inheritedLabel = t('label.inherited-entity', {
    entity: t('label.domain'),
  });

  const visibleDomains = useMemo(
    () => (showAll ? domains ?? [] : (domains ?? []).slice(0, maxVisible)),
    [domains, showAll, maxVisible]
  );

  const hiddenCount = (domains?.length ?? 0) - visibleDomains.length;

  if (isEmpty(domains)) {
    return (
      <span
        className="tw:text-sm tw:text-tertiary"
        data-testid="no-domain-text">
        {t('label.no-entity', { entity: t('label.domain-plural') })}
      </span>
    );
  }

  return (
    <div
      className={className}
      data-testid={dataTestId ?? 'domain-tags-container'}>
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-1.5">
        {visibleDomains.map((domain) => (
          <DomainTag
            closeButtonTestId={`remove-domain-${domain.fullyQualifiedName}`}
            data-testid={`domain-tag-${domain.fullyQualifiedName}`}
            href={
              onRemove ? undefined : getDomainPath(domain.fullyQualifiedName)
            }
            inherited={showInheritedIcon && domain.inherited}
            inheritedLabel={inheritedLabel}
            key={domain.id ?? domain.fullyQualifiedName}
            label={getEntityName(domain)}
            size={size}
            onDelete={onRemove ? () => onRemove(domain) : undefined}
          />
        ))}
        {hiddenCount > 0 && (
          <Button
            color="link-color"
            data-testid="show-all-domains"
            size="sm"
            onPress={() => setShowAll(true)}>
            {t('label.plus-count-more', { count: hiddenCount })}
          </Button>
        )}
        {showAll && (domains?.length ?? 0) > maxVisible && (
          <Button
            color="link-color"
            data-testid="show-less-domains"
            size="sm"
            onPress={() => setShowAll(false)}>
            {t('label.show-less')}
          </Button>
        )}
      </div>
    </div>
  );
};

export default DomainTags;
