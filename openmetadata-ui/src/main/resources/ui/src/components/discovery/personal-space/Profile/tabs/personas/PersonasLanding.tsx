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

import {
    Badge,
    Box,
    Card,
    EmptyPlaceholder,
    PaginationCardWithControls,
    Skeleton,
    Typography
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    PAGE_SIZE_BASE,
    PAGE_SIZE_LARGE,
    PAGE_SIZE_MEDIUM
} from '../../../../../../constants/constants';
import { TabSpecificField } from '../../../../../../enums/entity.enum';
import { Persona } from '../../../../../../generated/entity/teams/persona';
import { Paging } from '../../../../../../generated/type/paging';
import { useHashPagingParams } from '../../../../../../hooks/useSettingsHash';
import { getAllPersonas } from '../../../../../../rest/PersonaAPI';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { showErrorToast } from '../../../../../../utils/ToastUtils';
import RichTextEditorPreviewerV1 from '../../../../../common/RichTextEditor/RichTextEditorPreviewerV1';
import type { PersonaView } from './Personas.types';

const MAX_CURSOR_CACHE_PAGES = 100;

interface PersonasLandingProps {
  onNavigate: (view: PersonaView) => void;
}

const PersonasLanding = ({ onNavigate }: PersonasLandingProps) => {
  const { t } = useTranslation();
  const {
    page: currentPage,
    pageSize: hashPageSize,
    cursor: hashCursor,
    cursorType: hashCursorType,
    setPage: setHashPage,
  } = useHashPagingParams();
  const pageSize = hashPageSize || PAGE_SIZE_BASE;

  const [personas, setPersonas] = useState<Persona[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [paging, setPaging] = useState<Paging>({ total: 0 });
  const [cursorCache, setCursorCache] = useState<Map<number, Paging>>(
    new Map()
  );
  const fetchRequestIdRef = useRef(0);

  const showPagination = useMemo(
    () => Boolean(paging.before || paging.after) || paging.total > pageSize,
    [paging, pageSize]
  );

  const cacheCursor = (targetPage: number, nextPaging: Paging) =>
    setCursorCache((prev) => {
      const next = new Map(prev).set(targetPage, nextPaging);

      if (next.size > MAX_CURSOR_CACHE_PAGES) {
        [...next.keys()]
          .sort((a, b) => a - b)
          .slice(0, next.size - MAX_CURSOR_CACHE_PAGES)
          .forEach((k) => next.delete(k));
      }

      return next;
    });

  const fetchPersonas = async (
    pagingParam?: Partial<Paging>,
    targetPage = 1
  ) => {
    const requestId = ++fetchRequestIdRef.current;
    setIsLoading(true);
    try {
      const { data, paging: nextPaging } = await getAllPersonas({
        limit: pageSize,
        fields: TabSpecificField.USERS,
        after: pagingParam?.after,
        before: pagingParam?.before,
      });

      if (requestId !== fetchRequestIdRef.current) {
        return;
      }

      setPersonas(data || []);
      setPaging(nextPaging);
      cacheCursor(targetPage, nextPaging);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      if (requestId === fetchRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handlePageNavigation = (newPage: number) => {
    if (newPage === currentPage) {
      return;
    }

    if (newPage === 1) {
      setHashPage(1, undefined, undefined, pageSize);
      void fetchPersonas(undefined, 1);

      return;
    }

    const prevPaging = cursorCache.get(newPage - 1);
    const cursor =
      newPage > currentPage
        ? prevPaging?.after
        : cursorCache.get(newPage)?.before;

    if (newPage > currentPage && prevPaging?.after) {
      setHashPage(newPage, 'after', prevPaging.after, pageSize);
      void fetchPersonas({ after: prevPaging.after }, newPage);
    } else if (cursor) {
      setHashPage(newPage, 'before', cursor, pageSize);
      void fetchPersonas({ before: cursor }, newPage);
    }
  };

  const handlePageSizeChange = (size: number) => {
    setHashPage(1, undefined, undefined, size);
    setCursorCache(new Map());
  };

  useEffect(() => {
    if (currentPage <= 1 || !hashCursor) {
      if (currentPage > 1) {
        setHashPage(1, undefined, undefined, pageSize);
      }
      void fetchPersonas(undefined, 1);
    } else if (hashCursorType === 'before') {
      void fetchPersonas({ before: hashCursor }, currentPage);
    } else {
      void fetchPersonas({ after: hashCursor }, currentPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  const totalPages = Math.max(1, Math.ceil((paging.total ?? 0) / pageSize));

  if (!isLoading && personas.length === 0) {
    return (
      <Box
        align="center"
        className="tw:min-h-64 tw:px-8 tw:relative"
        data-testid="personas-landing-empty"
        justify="center">
        <EmptyPlaceholder
          title={t('label.no-entity-found', {
            entity: t('label.persona-plural'),
          })}
        />
      </Box>
    );
  }

  return (
    <Box
      className="tw:h-full tw:px-8 tw:pb-8"
      data-testid="personas-landing"
      direction="col"
      gap={5}>
      <Box className="tw:grid tw:grid-cols-1 tw:sm:grid-cols-2 tw:lg:grid-cols-3 tw:gap-5">
        {isLoading
          ? Array.from({ length: 3 }, (_, i) => (
              <Skeleton height={96} key={i} variant="rounded" />
            ))
          : personas.map((persona) => (
              <Card
                isClickable
                data-testid={`persona-card-${persona.name}`}
                key={persona.id}
                role="button"
                size="md"
                tabIndex={0}
                onClick={() =>
                  onNavigate({
                    type: 'detail',
                    fqn: persona.fullyQualifiedName ?? persona.name,
                    name: getEntityName(persona),
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onNavigate({
                      type: 'detail',
                      fqn: persona.fullyQualifiedName ?? persona.name,
                      name: getEntityName(persona),
                    });
                  }
                }}>
                <Card.Content>
                  <Box className="tw:min-w-0" direction="col" gap={2}>
                    <Box
                      align="center"
                      direction="row"
                      gap={2}
                      justify="between">
                      <Typography
                        className="tw:text-primary tw:truncate"
                        size="text-sm"
                        tooltip={getEntityName(persona)}
                        weight="semibold">
                        {getEntityName(persona)}
                      </Typography>
                      {persona.default && (
                        <Badge
                          color="blue"
                          data-testid="default-persona-tag"
                          size="sm"
                          type="color">
                          {t('label.default')}
                        </Badge>
                      )}
                    </Box>
                    {persona.description ? (
                      <RichTextEditorPreviewerV1
                        className="tw:text-tertiary tw:line-clamp-2"
                        markdown={persona.description}
                        maxLength={120}
                      />
                    ) : (
                      <Typography
                        className="tw:text-tertiary"
                        size="text-sm"
                        weight="regular">
                        {t('label.no-description')}
                      </Typography>
                    )}
                  </Box>
                </Card.Content>
              </Card>
            ))}
      </Box>

      {showPagination && (
        <PaginationCardWithControls
          page={currentPage}
          pageSize={pageSize}
          pageSizeOptions={[PAGE_SIZE_BASE, PAGE_SIZE_MEDIUM, PAGE_SIZE_LARGE]}
          total={totalPages}
          onPageChange={handlePageNavigation}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </Box>
  );
};

export default PersonasLanding;
