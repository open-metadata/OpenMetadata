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
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as PersonaIcon } from '../../../assets/svg/common/persona.svg';
import DocumentTitle from '../../../components/common/DocumentTitle/DocumentTitle';
import Loader from '../../../components/common/Loader/Loader';
import ContextCenterHeader from '../../../components/ContextCenter/ContextCenterHeader/ContextCenterHeader.component';
import { TabSpecificField } from '../../../enums/entity.enum';
import { Persona } from '../../../generated/entity/teams/persona';
import { useAuth } from '../../../hooks/authHooks';
import { getAllPersonas } from '../../../rest/PersonaAPI';
import contextCenterClassBase from '../../../utils/ContextCenterClassBase';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getScopedRuleCount } from '../../../utils/PersonaAIContextUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

const PERSONA_PAGE_SIZE = 50;
// Every persona must be reachable from this list — it is the only nav path to its AI context — so
// the cursor is followed to exhaustion rather than rendering one page. Bounded so a paging bug on
// the server cannot spin here.
const MAX_PERSONA_PAGES = 20;

const ContextCenterAIContextPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAdminUser } = useAuth();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPersonas = useCallback(async () => {
    try {
      setIsLoading(true);
      const collected: Persona[] = [];
      let after: string | undefined;
      for (let page = 0; page < MAX_PERSONA_PAGES; page++) {
        const { data, paging } = await getAllPersonas({
          after,
          fields: TabSpecificField.CONTEXT_DEFINITION,
          limit: PERSONA_PAGE_SIZE,
        });
        collected.push(...data);
        after = paging?.after;
        if (!after) {
          break;
        }
      }
      setPersonas(collected);
    } catch (error) {
      showErrorToast(error as AxiosError);
      setPersonas([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPersonas();
  }, [fetchPersonas]);

  const renderPersona = (persona: Persona) => {
    const rules = persona.contextDefinition?.rules ?? [];
    const scopedCount = getScopedRuleCount(rules);

    return (
      <Card
        className="tw:cursor-pointer tw:px-5 tw:py-4.5 tw:shadow-xs tw:transition tw:hover:bg-primary_hover"
        data-testid={`ai-context-persona-${persona.name}`}
        key={persona.id}
        onClick={() =>
          navigate(
            contextCenterClassBase.getAIContextPath(
              persona.fullyQualifiedName ?? persona.name
            )
          )
        }>
        <Box align="center" gap={4} justify="between">
          <Box className="tw:min-w-0" direction="col" gap={1}>
            <Typography
              className="tw:truncate tw:text-primary"
              size="text-md"
              weight="semibold">
              {getEntityName(persona)}
            </Typography>
            <Typography className="tw:truncate tw:text-tertiary" size="text-sm">
              {persona.description || t('label.no-description')}
            </Typography>
          </Box>
          <Box align="center" className="tw:shrink-0" gap={2}>
            <Badge color="blue-dark" size="sm" type="pill-color">
              {t('label.entity-count-rule-plural', { count: rules.length })}
            </Badge>
            {scopedCount > 0 && (
              <Badge color="gray" size="sm">
                {t('label.entity-count-filtered-in-search', {
                  count: scopedCount,
                })}
              </Badge>
            )}
          </Box>
        </Box>
      </Card>
    );
  };

  return (
    <div
      className={`tw:flex tw:flex-col tw:w-full tw:h-full tw:overflow-hidden tw:bg-secondary ${contextCenterClassBase.getContainerClassName()}`}
      data-testid="context-center-ai-context-page">
      <DocumentTitle title={t('label.ai-context')} />
      <div className="context-center-header-section tw:px-5">
        <ContextCenterHeader
          breadcrumbs={[{ label: t('label.ai-context') }]}
          hasPermission={isAdminUser}
          subtitle={t('message.persona-ai-context-description')}
          title={t('label.ai-context')}
        />
      </div>
      <div className="context-center-content-section tw:flex tw:flex-col tw:flex-1 tw:min-h-0 tw:gap-3 tw:overflow-y-auto tw:px-5 tw:pb-5">
        {isLoading && <Loader />}
        {!isLoading && personas.length === 0 && (
          <EmptyPlaceholder
            description={t('message.no-persona-ai-context-description')}
            icon={PersonaIcon}
            title={t('message.no-persona-available')}
          />
        )}
        {!isLoading && personas.map(renderPersona)}
      </div>
    </div>
  );
};

export default ContextCenterAIContextPage;
