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
import { Typography } from 'antd';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CloseIcon } from '../../../assets/svg/close-icon.svg';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit.svg';
import { ReactComponent as TickIcon } from '../../../assets/svg/tick.svg';
import { EntityType } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/entity/type';
import { DomainLabel } from '../DomainLabel/DomainLabel.component';
import DomainSelectableList from '../DomainSelectableList/DomainSelectableList.component';
import './DomainsSection.less';
interface DomainsSectionProps {
  domains?: EntityReference[];
  showEditButton?: boolean;
  entityType?: EntityType;
  entityFqn?: string;
  entityId?: string;
  hasPermission?: boolean;
}

const DomainsSection: React.FC<DomainsSectionProps> = ({
  domains = [],
  showEditButton = true,
  entityType,
  entityFqn,
  entityId,
  hasPermission = false,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editingDomains, setEditingDomains] = useState<EntityReference[]>([]);

  const handleEditClick = () => {
    setEditingDomains(domains);
    setIsEditing(true);
  };

  const handleSave = () => {
    // TODO: Implement actual save functionality
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditingDomains(domains);
    setIsEditing(false);
  };

  const handleDomainSelection = async (
    selectedDomains: EntityReference | EntityReference[]
  ) => {
    const domainsArray = Array.isArray(selectedDomains)
      ? selectedDomains
      : [selectedDomains];
    setEditingDomains(domainsArray);
  };

  if (!domains.length) {
    return (
      <div className="domains-section">
        <div className="domains-header">
          <Typography.Text className="domains-title">
            {t('label.domain-plural')}
          </Typography.Text>
          {showEditButton && !isEditing && (
            <span className="cursor-pointer" onClick={handleEditClick}>
              <EditIcon />
            </span>
          )}
          {isEditing && (
            <div className="edit-actions">
              <span className="cursor-pointer" onClick={handleCancel}>
                <CloseIcon />
              </span>
              <span className="cursor-pointer" onClick={handleSave}>
                <TickIcon />
              </span>
            </div>
          )}
        </div>
        <div className="domains-content">
          {isEditing ? (
            <div className="inline-edit-container">
              <DomainSelectableList
                multiple
                hasPermission={hasPermission}
                overlayClassName="w-auto"
                popoverProps={{ placement: 'bottomLeft' }}
                selectedDomain={editingDomains}
                wrapInButton={false}
                onUpdate={handleDomainSelection}
              >
                <div className="domain-selector-display">
                  {editingDomains.length > 0 ? (
                    <div className="selected-domains-list">
                      {editingDomains.map((domain) => (
                        <div className="selected-domain-chip" key={domain.id}>
                          <span className="domain-name">
                            {domain.displayName || domain.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="domain-placeholder">
                      {t('label.select-entity', {
                        entity: t('label.domain-plural'),
                      })}
                    </span>
                  )}
                </div>
              </DomainSelectableList>
            </div>
          ) : (
            <span className="no-data-placeholder">
              {t('label.no-data-found')}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="domains-section">
      <div className="domains-header">
        <Typography.Text className="domains-title">
          {t('label.domain-plural')}
        </Typography.Text>
        {showEditButton && !isEditing && (
          <span className="cursor-pointer" onClick={handleEditClick}>
            <EditIcon />
          </span>
        )}
        {isEditing && (
          <div className="edit-actions">
            <span className="cursor-pointer" onClick={handleCancel}>
              <CloseIcon />
            </span>
            <span className="cursor-pointer" onClick={handleSave}>
              <TickIcon />
            </span>
          </div>
        )}
      </div>
      <div className="domains-content">
        {isEditing ? (
          <div className="inline-edit-container">
            <DomainSelectableList
              multiple
              hasPermission={hasPermission}
              popoverProps={{ placement: 'bottomLeft' }}
              selectedDomain={editingDomains}
              wrapInButton={false}
              onUpdate={handleDomainSelection}
            >
              <div className="domain-selector-display">
                {editingDomains.length > 0 ? (
                  <div className="selected-domains-list">
                    {editingDomains.map((domain) => (
                      <div className="selected-domain-chip" key={domain.id}>
                        <span className="domain-name">
                          {domain.displayName || domain.name}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="domain-placeholder">
                    {t('label.select-entity', {
                      entity: t('label.domain-plural'),
                    })}
                  </span>
                )}
              </div>
            </DomainSelectableList>
          </div>
        ) : (
          <div className="domains-display">
            <DomainLabel
              multiple
              domains={domains}
              entityFqn={entityFqn || ''}
              entityId={entityId || ''}
              entityType={entityType || EntityType.TABLE}
              hasPermission={hasPermission}
              headerLayout={false}
              showDomainHeading={false}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default DomainsSection;
