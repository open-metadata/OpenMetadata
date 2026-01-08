/*
 *  Copyright 2024 Collate.
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
import { Button, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, isString } from 'lodash';
import React, { ReactNode, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as ShareIcon } from '../../../assets/svg/copy-right.svg';
import { ReactComponent as IconEdit } from '../../../assets/svg/edit-new.svg';
import { DE_ACTIVE_COLOR, ICON_DIMENSION } from '../../../constants/constants';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import EntityNameModal from '../../Modals/EntityNameModal/EntityNameModal.component';
import { EntityName } from '../../Modals/EntityNameModal/EntityNameModal.interface';
import { DisplayNameProps } from './DisplayName.interface';

const DisplayName: React.FC<DisplayNameProps> = ({
  id,
  name,
  displayName,
  onEditDisplayName,
  link,
  allowRename,
  hasEditPermission = false,
  entityType,
}) => {
  const { t } = useTranslation();

  const [isDisplayNameEditing, setIsDisplayNameEditing] = useState(false);
  const [copiedFqn, setCopiedFqn] = useState<string>();

  const getFieldLink = useCallback(
    (fqn: string) => {
      if (!entityType) {
        return '';
      }
      const fieldPath = getEntityDetailsPath(entityType, fqn);

      return `${window.location.origin}${fieldPath}`;
    },
    [entityType]
  );

  const handleCopyLink = useCallback(
    async (fqn: string) => {
      const fieldLink = getFieldLink(fqn);
      try {
        await navigator.clipboard.writeText(fieldLink);
        setCopiedFqn(fqn);
        setTimeout(() => setCopiedFqn(undefined), 2000);
      } catch {
        try {
          const textArea = document.createElement('textarea');
          textArea.value = fieldLink;
          textArea.style.position = 'fixed';
          textArea.style.opacity = '0';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          if (successful) {
            setCopiedFqn(fqn);
            setTimeout(() => setCopiedFqn(undefined), 2000);
          }
        } catch {
          // Silently fail if both methods don't work
        }
      }
    },
    [getFieldLink]
  );

  const handleDisplayNameUpdate = async (data: EntityName) => {
    setIsDisplayNameEditing(true);
    try {
      await onEditDisplayName?.(data, id);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsDisplayNameEditing(false);
    }
  };

  // function to render text with optional link
  const renderNameWithOptionalLink = (displayText: ReactNode) => {
    return link ? (
      <Link className="break-word" data-testid={name} to={link}>
        {displayText}
      </Link>
    ) : (
      <span className="break-word" data-testid={name}>
        {displayText}
      </span>
    );
  };

  const renderMainContent = useMemo(() => {
    if (isEmpty(displayName)) {
      return renderNameWithOptionalLink(name);
    }

    // Show both name and displayName when displayName exists
    return (
      <>
        <Typography.Text className="break-word text-grey-600">
          {name}
        </Typography.Text>
        <Typography.Text
          className="d-block break-word"
          data-testid="column-display-name">
          {renderNameWithOptionalLink(displayName)}
        </Typography.Text>
      </>
    );
  }, [displayName, name, renderNameWithOptionalLink]);

  return (
    <div className="d-inline-flex flex-column hover-icon-group w-max-full vertical-align-inherit">
      <div className="d-inline-flex items-center gap-2">
        <Typography.Text className="m-b-0 d-block" data-testid="column-name">
          {renderMainContent}
        </Typography.Text>

        <div className="d-flex items-center">
          {hasEditPermission ? (
            <Tooltip placement="top" title={t('label.edit')}>
              <Button
                ghost
                className="hover-cell-icon flex-center"
                data-testid="edit-displayName-button"
                icon={<IconEdit color={DE_ACTIVE_COLOR} {...ICON_DIMENSION} />}
                style={{
                  width: '24px',
                  height: '24px',
                }}
                type="text"
                onClick={() => setIsDisplayNameEditing(true)}
              />
            </Tooltip>
          ) : null}

          {entityType && id && (
            <Tooltip
              placement="top"
              title={
                copiedFqn === id
                  ? t('message.link-copy-to-clipboard')
                  : t('label.copy-item', { item: t('label.url-uppercase') })
              }>
              <Button
                className="cursor-pointer hover-cell-icon flex-center"
                data-testid="copy-column-link-button"
                style={{
                  color: DE_ACTIVE_COLOR,
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  width: '24px',
                  height: '24px',
                }}
                onClick={() => handleCopyLink(id)}>
                <ShareIcon
                  style={{ color: DE_ACTIVE_COLOR, ...ICON_DIMENSION }}
                />
              </Button>
            </Tooltip>
          )}
        </div>
      </div>

      {isDisplayNameEditing && (
        <EntityNameModal
          allowRename={allowRename}
          entity={{
            name: isString(name) ? name : '',
            displayName: isString(displayName) ? displayName : undefined,
          }}
          title={t('label.edit-entity', {
            entity: t('label.display-name'),
          })}
          visible={isDisplayNameEditing}
          onCancel={() => setIsDisplayNameEditing(false)}
          onSave={handleDisplayNameUpdate}
        />
      )}
    </div>
  );
};

export default DisplayName;
