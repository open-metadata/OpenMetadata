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

import React, { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { EntityType } from '../../../../enums/entity.enum';
import entityUtilClassBase from '../../../../utils/EntityUtilClassBase';
import EntityPopOverCard from '../../PopOverCard/EntityPopOverCard';
import {
  EntityMarkdownLinkProps,
  ParsedEntityLink,
} from './EntityMarkdownLink.interface';

const parseEntityLink = (href: string): ParsedEntityLink => {
  if (!href || !href.startsWith('#')) {
    return { isEntityLink: false };
  }

  const match = href.match(/^#([^/]+)\/(.+)$/);
  if (!match) {
    return { isEntityLink: false };
  }

  const [, entityTypeStr, rest] = match;

  const entityType = Object.values(EntityType).find(
    (type) => type === entityTypeStr
  );

  if (!entityType) {
    return { isEntityLink: false };
  }

  if (entityType === EntityType.INGESTION_PIPELINE) {
    const parts = rest.split('/');
    if (parts.length < 3) {
      return { isEntityLink: false };
    }
    const [serviceCategory, encodedServiceFqn, ...fqnParts] = parts;
    const serviceFqn = decodeURIComponent(encodedServiceFqn);
    const fullyQualifiedName = decodeURIComponent(fqnParts.join('/'));

    return {
      isEntityLink: true,
      entityInfo: { entityType, fullyQualifiedName, serviceCategory, serviceFqn },
    };
  }

  return {
    isEntityLink: true,
    entityInfo: {
      entityType: entityType as EntityType,
      fullyQualifiedName: decodeURIComponent(rest),
    },
  };
};

const EntityMarkdownLink: React.FC<EntityMarkdownLinkProps> = ({
  href,
  children,
  className,
}) => {
  const { parsedLink, entityPath } = useMemo(() => {
    const parsed = parseEntityLink(href || '');
    const path =
      parsed.isEntityLink && parsed.entityInfo
        ? entityUtilClassBase.getEntityLink(
            parsed.entityInfo.entityType,
            parsed.entityInfo.fullyQualifiedName,
            undefined,
            undefined,
            undefined,
            undefined,
            parsed.entityInfo.serviceCategory,
            parsed.entityInfo.serviceFqn
          )
        : '';

    return { parsedLink: parsed, entityPath: path };
  }, [href]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!parsedLink.isEntityLink || !parsedLink.entityInfo) {
        return;
      }

      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        window.open(entityPath, '_blank');
      }
    },
    [parsedLink, entityPath]
  );

  if (!parsedLink.isEntityLink || !parsedLink.entityInfo) {
    return (
      <a className={className} href={href}>
        {children}
      </a>
    );
  }

  return (
    <EntityPopOverCard
      entityFQN={parsedLink.entityInfo.fullyQualifiedName}
      entityType={parsedLink.entityInfo.entityType}>
      <Link
        className={`entity-markdown-link ${className || ''}`}
        to={entityPath}
        onClick={handleClick}>
        {children}
      </Link>
    </EntityPopOverCard>
  );
};

export default EntityMarkdownLink;
