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
import { Dropdown, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { ReactComponent as DomainIcon } from '../../../assets/svg/ic-domain.svg';
import { EntityReference } from '../../../generated/entity/type';
import { getEntityName } from '../../../utils/EntityUtils';
import { getDomainPath } from '../../../utils/RouterUtils';

interface DomainDisplayProps {
  domains: EntityReference[];
  showIcon?: boolean;
  className?: string;
}

const DomainLink: React.FC<{
  domain: EntityReference;
}> = ({ domain }) => (
  <>
    <Link
      className="no-underline"
      data-testid="domain-link"
      to={getDomainPath(domain.fullyQualifiedName) ?? ''}>
      <Typography.Text className="text-sm text-primary">
        {getEntityName(domain)}
      </Typography.Text>
    </Link>
  </>
);

export const DomainDisplay = ({
  domains,
  showIcon = true,
  className = '',
}: DomainDisplayProps) => {
  if (!domains || domains.length === 0) {
    return null;
  }

  if (domains.length > 1) {
    const firstDomain = domains[0];
    const remainingDomains = domains.slice(1);
    const remainingCount = remainingDomains.length;

    const dropdownItems = remainingDomains.map((domain, index) => ({
      key: index,
      label: (
        <div className="d-flex items-center gap-2">
          <DomainIcon height={14} name="domain" width={14} />
          <Link
            className="no-underline"
            to={getDomainPath(domain.fullyQualifiedName) ?? ''}>
            <Typography.Text className="text-sm text-primary">
              {getEntityName(domain)}
            </Typography.Text>
          </Link>
        </div>
      ),
    }));

    return (
      <div className={`d-flex items-center gap-2 ${className}`}>
        {showIcon && (
          <div className="d-flex">
            <DomainIcon
              data-testid="domain-icon"
              height={18}
              name="domain"
              width={18}
            />
          </div>
        )}

        <div className="d-flex items-center gap-2">
          <DomainLink domain={firstDomain} />

          <Dropdown
            menu={{
              items: dropdownItems,
              className: 'domain-tooltip-list',
            }}
            trigger={['hover']}>
            <Typography.Text
              className={`flex-center cursor-pointer align-middle ant-typography-secondary domain-count-button ${
                remainingCount <= 9 ? 'h-6 w-6' : ''
              }`}
              data-testid="domain-count-button">
              <span className="ant-typography domain-count-label">
                {`+${remainingCount}`}
              </span>
            </Typography.Text>
          </Dropdown>
        </div>
      </div>
    );
  }

  return (
    <div className={`d-flex items-center gap-2 ${className}`}>
      {showIcon && (
        <div className="d-flex">
          <DomainIcon
            data-testid="domain-icon"
            height={18}
            name="domain"
            width={18}
          />
        </div>
      )}

      <div className="d-flex items-center gap-1">
        <DomainLink domain={domains[0]} />
      </div>
    </div>
  );
};
