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

import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ROUTES } from '../../../../constants/constants';
import { EntityType } from '../../../../enums/entity.enum';
import entityUtilClassBase from '../../../../utils/EntityUtilClassBase';
import EntityPopOverCard from '../../PopOverCard/EntityPopOverCard';
import DocumentMarkdownLink from './DocumentMarkdownLink';
import {
  EntityLinkInfo,
  EntityMarkdownLinkProps,
  ParsedEntityLink,
} from './EntityMarkdownLink.interface';

/**
 * A file uploaded to a chat is a Context Center document, and the chat knows it only by the id of
 * the stored asset. `#document/<assetId>` is that reference; it is not an entity type, so it is
 * resolved before the entity-type check rather than made to pass it.
 */
export const DOCUMENT_LINK_PREFIX = '#document/';

const parseEntityLink = (href: string): ParsedEntityLink => {
  if (!href || !href.startsWith('#')) {
    return { isEntityLink: false };
  }

  const match = href.match(/^#([^/]+)\/(.+)$/);
  if (!match) {
    return { isEntityLink: false };
  }

  const [, entityTypeStr, rest] = match;

  const entityType = entityUtilClassBase
    .getEntityTypes()
    .find((type) => type === entityTypeStr);

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
      entityInfo: {
        entityType,
        fullyQualifiedName,
        serviceCategory,
        serviceFqn,
      },
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

// Settings links (team, role, bot, …) carry the page's query string in AI mode,
// so the link is built on every render and re-rendered on navigation rather
// than memoized with the query string it first saw. Only entity links read the
// location: they render a router Link, so they already need a Router.
const EntityLinkAnchor: React.FC<{
  entityInfo: EntityLinkInfo;
  className?: string;
  children?: React.ReactNode;
}> = ({ entityInfo, className, children }) => {
  useLocation();
  const entityPath = entityUtilClassBase.getEntityLink(
    entityInfo.entityType,
    entityInfo.fullyQualifiedName,
    undefined,
    undefined,
    undefined,
    undefined,
    entityInfo.serviceCategory,
    entityInfo.serviceFqn
  );

  const handleClick = (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      window.open(entityPath, '_blank');
    }
  };

  return (
    <EntityPopOverCard
      entityFQN={entityInfo.fullyQualifiedName}
      entityType={entityInfo.entityType}>
      <Link
        className={`entity-markdown-link ${className || ''}`}
        to={entityPath}
        onClick={handleClick}>
        {children}
      </Link>
    </EntityPopOverCard>
  );
};

const ResolvedEntityLink: React.FC<EntityMarkdownLinkProps> = ({
  href,
  children,
  className,
}) => {
  const parsedLink = useMemo(() => parseEntityLink(href || ''), [href]);

  if (!parsedLink.isEntityLink || !parsedLink.entityInfo) {
    return (
      <a className={className} href={href}>
        {children}
      </a>
    );
  }

  return (
    <EntityLinkAnchor className={className} entityInfo={parsedLink.entityInfo}>
      {children}
    </EntityLinkAnchor>
  );
};

const EntityMarkdownLink: React.FC<EntityMarkdownLinkProps> = ({
  href,
  children,
  className,
}) => {
  if (href?.startsWith(DOCUMENT_LINK_PREFIX)) {
    return (
      <DocumentMarkdownLink
        assetId={decodeURIComponent(href.slice(DOCUMENT_LINK_PREFIX.length))}
        className={className}
        documentsRoute={ROUTES.CONTEXT_CENTER_DOCUMENTS}>
        {children}
      </DocumentMarkdownLink>
    );
  }

  return (
    <ResolvedEntityLink className={className} href={href}>
      {children}
    </ResolvedEntityLink>
  );
};

export default EntityMarkdownLink;
