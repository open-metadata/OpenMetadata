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
import { Button } from 'antd';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityReference } from '../../../generated/entity/type';
import SectionWithEdit from '../SectionWithEdit/SectionWithEdit';
import './OwnersSection.less';

interface OwnersSectionProps {
  owners?: EntityReference[];
  onEdit?: () => void;
  showEditButton?: boolean;
  maxDisplayCount?: number;
}

const OwnersSection: React.FC<OwnersSectionProps> = ({
  owners = [],
  onEdit,
  showEditButton = true,
  maxDisplayCount = 2,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const displayedOwners = isExpanded
    ? owners
    : owners.slice(0, maxDisplayCount);
  const remainingCount = owners.length - maxDisplayCount;
  const shouldShowMore = remainingCount > 0 && !isExpanded;

  const getOwnerDisplayName = (owner: EntityReference) => {
    return owner.displayName || owner.name || t('label.unknown');
  };

  if (!owners.length) {
    return (
      <SectionWithEdit
        showEditButton={showEditButton}
        title={t('label.owner-plural')}
        onEdit={onEdit}>
        <span className="no-data-placeholder">{t('label.no-data-found')}</span>
      </SectionWithEdit>
    );
  }

  return (
    <SectionWithEdit
      showEditButton={showEditButton}
      title={t('label.owner-plural')}
      onEdit={onEdit}>
      <div className="owners-content">
        <div className="owners-list">
          {displayedOwners.map((owner, index) => (
            <div className="owner-item" key={index}>
              <span className="owner-name">{getOwnerDisplayName(owner)}</span>
            </div>
          ))}
        </div>
        {shouldShowMore && (
          <Button
            className="show-more-button"
            size="small"
            type="link"
            onClick={() => setIsExpanded(true)}>
            {t('label.plus-count-more', { count: remainingCount })}
          </Button>
        )}
        {isExpanded && remainingCount > 0 && (
          <Button
            className="show-less-button"
            size="small"
            type="link"
            onClick={() => setIsExpanded(false)}>
            {t('label.show-less-lowercase')}
          </Button>
        )}
      </div>
    </SectionWithEdit>
  );
};

export default OwnersSection;
