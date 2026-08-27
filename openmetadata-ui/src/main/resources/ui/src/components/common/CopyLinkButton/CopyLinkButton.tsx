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
import { Button, Tooltip } from 'antd';
import { FC, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ShareIcon } from '../../../assets/svg/copy-right.svg';
import { DE_ACTIVE_COLOR, ICON_DIMENSION } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { useClipboard } from '../../../hooks/useClipBoard';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';

interface CopyLinkButtonProps {
  entityType: EntityType;
  fieldFqn: string;
  testId?: string;
}

const CopyLinkButton: FC<CopyLinkButtonProps> = ({
  entityType,
  fieldFqn,
  testId = 'copy-field-link-button',
}) => {
  const { t } = useTranslation();
  const { onCopyToClipBoard, hasCopied } = useClipboard('');

  const handleCopyFieldLink = useCallback(
    async (fqn: string) => {
      const path = getEntityDetailsPath(entityType, fqn);
      const link = `${window.location.origin}${path}`;
      await onCopyToClipBoard(link);
    },
    [entityType, onCopyToClipBoard]
  );

  return (
    <Tooltip
      placement="top"
      title={
        hasCopied
          ? t('message.link-copy-to-clipboard')
          : t('label.copy-item', { item: t('label.url-uppercase') })
      }>
      <Button
        className="cursor-pointer hover-cell-icon flex-center"
        data-testid={testId}
        disabled={!fieldFqn}
        style={{
          color: DE_ACTIVE_COLOR,
          padding: 0,
          border: 'none',
          background: 'transparent',
          width: '24px',
          height: '24px',
        }}
        onClick={() => fieldFqn && handleCopyFieldLink(fieldFqn)}>
        <ShareIcon style={{ color: DE_ACTIVE_COLOR, ...ICON_DIMENSION }} />
      </Button>
    </Tooltip>
  );
};

export default CopyLinkButton;
