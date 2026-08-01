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
import { Space } from 'antd';
import { Button } from '@openmetadata/ui-core-components';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as ExternalLinkIcon } from '../../../assets/svg/external-links.svg';
import { ReactComponent as UnlinkIcon } from '../../../assets/svg/ic-format-unlink.svg';

import { FC } from 'react';

interface LinkPopupProps {
  href: string;
  handleLinkToggle: () => void;
  handleUnlink: () => void;
}

const iconSize = 14;

const LinkPopup: FC<LinkPopupProps> = ({
  href,
  handleLinkToggle,
  handleUnlink,
}) => {
  return (
    <Space className="link-popup">
      <Button
        className="p-0"
        data-testid="link-popup-edit"
        onClick={handleLinkToggle}
        color='tertiary'
        iconLeading={<EditIcon width={iconSize} />}
      />
      <Button
        className="p-0"
        data-testid="link-popup-open"
        href={href}
        target="_blank"
        color='link-gray'
        iconLeading={<ExternalLinkIcon width={iconSize + 2} />}
      />
      <Button
        className="p-0"
        data-testid="link-popup-unlink"
        onClick={handleUnlink}
        color='tertiary'
        iconLeading={<UnlinkIcon width={iconSize} />}
      />
    </Space>
  );
};

export default LinkPopup;
