/*
 *  Copyright 2026 Collate.
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
import { CSSProperties, useEffect, useState } from 'react';
import { Style } from '../generated/entity/domains/domain';
import { EntityReference } from '../generated/entity/type';
import { getDomainByName } from '../rest/domainAPI';

export type StyledDomainReference = EntityReference & {
  style?: Style;
};

type CachedDomainStyleEntry = {
  expiresAt: number;
  style: Style | null;
};

const DOMAIN_STYLE_CACHE_TTL_MS = 5 * 60 * 1000;

const domainStyleCache = new Map<string, CachedDomainStyleEntry>();
const domainStyleRequestCache = new Map<string, Promise<Style | undefined>>();

export const clearDomainStyleCache = () => {
  domainStyleCache.clear();
  domainStyleRequestCache.clear();
};

const getStyleFromDomainReference = (
  domain: EntityReference
): Style | undefined => (domain as StyledDomainReference).style;

const getDomainSignature = (domain: EntityReference): string =>
  [
    domain.id ?? '',
    domain.fullyQualifiedName ?? '',
    domain.name ?? '',
    domain.displayName ?? '',
    domain.type ?? '',
    domain.inherited ? '1' : '0',
    getStyleFromDomainReference(domain)?.color ?? '',
  ].join('::');

const pruneExpiredDomainStyleCache = (now = Date.now()) => {
  for (const [domainFqn, cachedEntry] of domainStyleCache.entries()) {
    if (cachedEntry.expiresAt <= now) {
      domainStyleCache.delete(domainFqn);
    }
  }
};

const setCachedDomainStyle = (domainFqn: string, style: Style | null) => {
  const now = Date.now();

  pruneExpiredDomainStyleCache(now);
  domainStyleCache.set(domainFqn, {
    expiresAt: now + DOMAIN_STYLE_CACHE_TTL_MS,
    style,
  });
};

const getCachedDomainStyle = (
  domainFqn: string
): CachedDomainStyleEntry | undefined => {
  const cachedEntry = domainStyleCache.get(domainFqn);

  if (!cachedEntry) {
    return undefined;
  }

  if (cachedEntry.expiresAt <= Date.now()) {
    domainStyleCache.delete(domainFqn);

    return undefined;
  }

  return cachedEntry;
};

const getStyledDomainReference = (
  domain: EntityReference
): StyledDomainReference => {
  const style = getStyleFromDomainReference(domain);
  const domainFqn = domain.fullyQualifiedName;

  if (domainFqn && style !== undefined) {
    setCachedDomainStyle(domainFqn, style);

    return domain as StyledDomainReference;
  }

  const cachedEntry = domainFqn ? getCachedDomainStyle(domainFqn) : undefined;

  if (cachedEntry?.style) {
    return { ...domain, style: cachedEntry.style };
  }

  return domain as StyledDomainReference;
};

const fetchDomainStyle = async (domainFqn: string) => {
  const cachedEntry = getCachedDomainStyle(domainFqn);

  if (cachedEntry) {
    return cachedEntry.style ?? undefined;
  }

  const cachedRequest = domainStyleRequestCache.get(domainFqn);

  if (cachedRequest) {
    return cachedRequest;
  }

  const request = getDomainByName(domainFqn, { fields: 'style' })
    .then((domain) => {
      const style = domain.style;

      setCachedDomainStyle(domainFqn, style ?? null);

      return style;
    })
    .catch(() => {
      setCachedDomainStyle(domainFqn, null);

      return undefined;
    })
    .finally(() => {
      domainStyleRequestCache.delete(domainFqn);
    });

  domainStyleRequestCache.set(domainFqn, request);

  return request;
};

export const useDomainsWithStyle = (
  domains?: EntityReference[]
): StyledDomainReference[] => {
  const cacheWindow = Math.floor(Date.now() / DOMAIN_STYLE_CACHE_TTL_MS);
  const domainsSignature = (domains ?? []).map(getDomainSignature).join('|');
  const [resolvedDomains, setResolvedDomains] = useState<
    StyledDomainReference[]
  >(() => (domains ?? []).map(getStyledDomainReference));

  useEffect(() => {
    const nextDomains = (domains ?? []).map(getStyledDomainReference);
    setResolvedDomains(nextDomains);

    const missingDomainFqns = nextDomains
      .map((domain) => domain.fullyQualifiedName)
      .filter((domainFqn): domainFqn is string => {
        if (!domainFqn) {
          return false;
        }

        return !getCachedDomainStyle(domainFqn);
      });

    if (missingDomainFqns.length === 0) {
      return;
    }

    let isCancelled = false;

    void Promise.all(
      [...new Set(missingDomainFqns)].map(async (domainFqn) => [
        domainFqn,
        await fetchDomainStyle(domainFqn),
      ])
    )
      .then(() => {
        if (isCancelled) {
          return;
        }

        setResolvedDomains((currentDomains) =>
          currentDomains.map(getStyledDomainReference)
        );
      })
      .catch(() => undefined);

    return () => {
      isCancelled = true;
    };
  }, [cacheWindow, domainsSignature]);

  return resolvedDomains;
};

export const getDomainReferenceColor = (
  domain: EntityReference
): string | undefined => getStyleFromDomainReference(domain)?.color;

export const getDomainReferenceIconColor = (
  domain: EntityReference,
  fallbackColor: string
): string => getDomainReferenceColor(domain) ?? fallbackColor;

export const getDomainReferenceBadgeStyle = (
  domain: EntityReference
): CSSProperties | undefined => {
  const color = getDomainReferenceColor(domain);

  return color
    ? {
        borderColor: color,
        boxShadow: `inset 3px 0 0 ${color}`,
      }
    : undefined;
};
