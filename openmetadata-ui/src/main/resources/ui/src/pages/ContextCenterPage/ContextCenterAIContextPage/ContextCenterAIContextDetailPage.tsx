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

import { EmptyPlaceholder } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as PersonaIcon } from '../../../assets/svg/common/persona.svg';
import DocumentTitle from '../../../components/common/DocumentTitle/DocumentTitle';
import Loader from '../../../components/common/Loader/Loader';
import ContextCenterHeader from '../../../components/ContextCenter/ContextCenterHeader/ContextCenterHeader.component';
import { PersonaAIContext } from '../../../components/ContextCenter/PersonaAIContext/PersonaAIContext.component';
import { Persona } from '../../../generated/entity/teams/persona';
import { useAuth } from '../../../hooks/authHooks';
import { useFqn } from '../../../hooks/useFqn';
import { getPersonaByName } from '../../../rest/PersonaAPI';
import contextCenterClassBase from '../../../utils/ContextCenterClassBase';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

const ContextCenterAIContextDetailPage = () => {
  const { t } = useTranslation();
  const { fqn } = useFqn();
  const { isAdminUser } = useAuth();
  const [persona, setPersona] = useState<Persona>();
  const [isLoading, setIsLoading] = useState(true);

  const fetchPersona = useCallback(async () => {
    if (!fqn) {
      setIsLoading(false);

      return;
    }
    try {
      setIsLoading(true);
      setPersona(await getPersonaByName(fqn));
    } catch (error) {
      showErrorToast(error as AxiosError);
      setPersona(undefined);
    } finally {
      setIsLoading(false);
    }
  }, [fqn]);

  useEffect(() => {
    fetchPersona();
  }, [fetchPersona]);

  const personaName = persona ? getEntityName(persona) : fqn;

  return (
    <div
      className={`tw:flex tw:flex-col tw:w-full tw:h-full tw:overflow-hidden tw:bg-secondary ${contextCenterClassBase.getContainerClassName()}`}
      data-testid="context-center-ai-context-detail-page">
      <DocumentTitle title={personaName} />
      <div className="context-center-header-section tw:px-5">
        <ContextCenterHeader
          breadcrumbs={[
            {
              label: t('label.ai-context'),
              href: contextCenterClassBase.getAIContextListPath(),
            },
            { label: personaName },
          ]}
          hasPermission={isAdminUser}
          subtitle={t('message.persona-ai-context-description')}
          title={personaName}
        />
      </div>
      <div className="context-center-content-section tw:flex tw:flex-col tw:flex-1 tw:min-h-0 tw:overflow-y-auto tw:px-5 tw:pb-5">
        {isLoading && <Loader />}
        {!isLoading && !persona && (
          <EmptyPlaceholder
            description={t('message.no-persona-ai-context-description')}
            icon={PersonaIcon}
            title={t('message.no-persona-available')}
          />
        )}
        {!isLoading && persona && (
          <PersonaAIContext
            canEdit={Boolean(isAdminUser)}
            persona={persona}
            onPersonaUpdate={fetchPersona}
          />
        )}
      </div>
    </div>
  );
};

export default ContextCenterAIContextDetailPage;
