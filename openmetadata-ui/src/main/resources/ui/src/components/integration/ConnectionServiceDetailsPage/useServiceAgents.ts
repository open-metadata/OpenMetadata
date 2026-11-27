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

import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AUTO_PILOT_APP_NAME } from '../../../constants/Applications.constant';
import { SERVICE_INSIGHTS_WORKFLOW_DEFINITION_NAME } from '../../../constants/ServiceInsightsTab.constants';
import { SERVICE_INGESTION_PIPELINE_TYPES } from '../../../constants/Services.constant';
import { TabSpecificField } from '../../../enums/entity.enum';
import {
  ServiceAgentSubTabs,
  ServiceCategory,
} from '../../../enums/service.enum';
import { IngestionPipeline } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import {
  WorkflowInstance,
  WorkflowStatus,
} from '../../../generated/governance/workflows/workflowInstance';
import { Paging } from '../../../generated/type/paging';
import { usePaging } from '../../../hooks/paging/usePaging';
import { ServicesType } from '../../../interface/service.interface';
import {
  CollateAgentAutomation,
  getAiAutomationsByService,
  triggerOnDemandApp,
} from '../../../rest/applicationAPI';
import { getIngestionPipelines } from '../../../rest/ingestionPipelineAPI';
import {
  getWorkflowInstancesForApplication,
  getWorkflowInstanceStateById,
} from '../../../rest/workflowAPI';
import {
  getCurrentMillis,
  getDayAgoStartGMTinMillis,
} from '../../../utils/date-time/DateTimeUtils';
import { getEntityFeedLink } from '../../../utils/EntityPureUtils';
import { AutoPilotAction } from '../../../utils/ExtensionPointTypes';
import { getEntityTypeFromServiceCategory } from '../../../utils/ServicePureUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useAgentActionAvailability } from '../../ServiceAgents/hooks/useAgentActionAvailability';
import { useMetadataAgents } from '../../ServiceAgents/hooks/useMetadataAgents';
import { WorkflowStatesData } from '../../ServiceInsights/ServiceInsightsTab.interface';

/** How many times to re-read the AutoPilot workflow status after triggering it, and how long to
 * wait between reads. Bounded so a run that never registers cannot leave the trigger disabled. */
const AUTO_PILOT_STATUS_READ_ATTEMPTS = 3;
const AUTO_PILOT_STATUS_READ_DELAY_MS = 1500;

interface UseServiceAgentsArgs {
  serviceCategory: ServiceCategory;
  serviceDetails?: ServicesType;
  /** AI automations live behind an endpoint only a downstream build serves, so they are fetched
   * only when that build contributes the widget that lists them — the classic page's rule. */
  fetchAiAgents: boolean;
}

/**
 * Everything the AI-mode service page's Agents tab, its badge, the Insights tab and the header
 * AutoPilot button share: the service's metadata agents, its AI automations, and the AutoPilot
 * workflow state with the trigger that starts a run. Held once at page level so the four read the
 * same lists instead of each fetching its own.
 */
export const useServiceAgents = ({
  serviceCategory,
  serviceDetails,
  fetchAiAgents,
}: UseServiceAgentsArgs) => {
  const { t } = useTranslation();
  const serviceFqn = serviceDetails?.fullyQualifiedName ?? '';
  const isServiceDeleted = serviceDetails?.deleted ?? false;
  // The page stays mounted when it navigates to another service, so a response that lands after the
  // switch belongs to the previous service and must not be stored.
  const currentFqnRef = useRef(serviceFqn);
  currentFqnRef.current = serviceFqn;

  const {
    isPending: isAgentActionPending,
    isUnavailable: isAgentActionUnavailable,
  } = useAgentActionAvailability();

  const [ingestionPipelines, setIngestionPipelines] = useState<
    IngestionPipeline[]
  >([]);
  const [isIngestionPipelineLoading, setIsIngestionPipelineLoading] =
    useState(true);
  const [collateAgentsList, setCollateAgentsList] = useState<
    CollateAgentAutomation[]
  >([]);
  const [isCollateAgentLoading, setIsCollateAgentLoading] =
    useState(fetchAiAgents);
  const [workflowStatesData, setWorkflowStatesData] =
    useState<WorkflowStatesData>();
  // Seeded true so the AutoPilot trigger stays disabled until we know whether a run is in flight —
  // otherwise a fast click starts a second run before the first status read lands.
  const [isWorkflowStatusLoading, setIsWorkflowStatusLoading] = useState(true);
  const [isAutopilotTriggering, setIsAutopilotTriggering] = useState(false);

  const ingestionPagingInfo = usePaging();
  const collateAgentPagingInfo = usePaging();
  const { handlePagingChange: handleIngestionPagingChange } =
    ingestionPagingInfo;
  const { handlePagingChange: handleCollateAgentPagingChange } =
    collateAgentPagingInfo;

  const { agents: metadataAgents, discoveredCount } = useMetadataAgents(
    ingestionPipelines,
    serviceCategory,
    serviceFqn
  );

  const getAllIngestionWorkflows = useCallback(
    async (paging?: Omit<Paging, 'total'>, limit?: number) => {
      if (!serviceFqn) {
        return;
      }
      try {
        setIsIngestionPipelineLoading(true);
        const response = await getIngestionPipelines({
          arrQueryFields: [
            TabSpecificField.OWNERS,
            TabSpecificField.PIPELINE_STATUSES,
          ],
          serviceFilter: serviceFqn,
          serviceType: getEntityTypeFromServiceCategory(serviceCategory),
          paging,
          pipelineType: SERVICE_INGESTION_PIPELINE_TYPES,
          limit,
        });
        if (currentFqnRef.current === serviceFqn) {
          setIngestionPipelines(response.data ?? []);
          handleIngestionPagingChange(response.paging ?? ({} as Paging));
        }
      } catch (error) {
        if (currentFqnRef.current === serviceFqn) {
          setIngestionPipelines([]);
          handleIngestionPagingChange({} as Paging);
          showErrorToast(error as AxiosError);
        }
      } finally {
        if (currentFqnRef.current === serviceFqn) {
          setIsIngestionPipelineLoading(false);
        }
      }
    },
    [serviceFqn, serviceCategory, handleIngestionPagingChange]
  );

  const fetchCollateAgentsList = useCallback(async () => {
    // A deleted service has no live automations and the endpoint 404s on it.
    if (!fetchAiAgents || !serviceFqn || isServiceDeleted) {
      setCollateAgentsList([]);
      setIsCollateAgentLoading(false);

      return;
    }
    try {
      setIsCollateAgentLoading(true);
      const { data } = await getAiAutomationsByService(
        serviceFqn,
        getEntityTypeFromServiceCategory(serviceCategory)
      );
      if (currentFqnRef.current === serviceFqn) {
        setCollateAgentsList(data);
        handleCollateAgentPagingChange({ total: data.length });
      }
    } catch (error) {
      if (currentFqnRef.current === serviceFqn) {
        showErrorToast(error as AxiosError);
      }
    } finally {
      if (currentFqnRef.current === serviceFqn) {
        setIsCollateAgentLoading(false);
      }
    }
  }, [
    fetchAiAgents,
    serviceFqn,
    serviceCategory,
    isServiceDeleted,
    handleCollateAgentPagingChange,
  ]);

  const fetchWorkflowInstanceStates = useCallback(async (): Promise<
    WorkflowInstance | undefined
  > => {
    if (!serviceFqn) {
      return undefined;
    }
    try {
      setIsWorkflowStatusLoading(true);
      const startTs = getDayAgoStartGMTinMillis(6);
      const endTs = getCurrentMillis();
      const workflowInstances = await getWorkflowInstancesForApplication({
        startTs,
        endTs,
        workflowDefinitionName: SERVICE_INSIGHTS_WORKFLOW_DEFINITION_NAME,
        entityLink: getEntityFeedLink(
          getEntityTypeFromServiceCategory(serviceCategory),
          serviceFqn
        ),
      });
      const mainInstanceState = workflowInstances.data[0];
      const subInstanceStates = mainInstanceState?.id
        ? (
            await getWorkflowInstanceStateById(
              SERVICE_INSIGHTS_WORKFLOW_DEFINITION_NAME,
              mainInstanceState.id,
              { startTs, endTs }
            )
          ).data
        : undefined;
      if (currentFqnRef.current !== serviceFqn) {
        return undefined;
      }
      // Cleared when the service has no run, so a service never shows another's states.
      setWorkflowStatesData(
        mainInstanceState && subInstanceStates
          ? { mainInstanceState, subInstanceStates }
          : undefined
      );

      // Returned as well as stored: the trigger acts on the status it just read.
      return mainInstanceState;
    } catch (error) {
      if (currentFqnRef.current === serviceFqn) {
        showErrorToast(error as AxiosError);
      }
    } finally {
      if (currentFqnRef.current === serviceFqn) {
        setIsWorkflowStatusLoading(false);
      }
    }

    return undefined;
  }, [serviceFqn, serviceCategory]);

  useEffect(() => {
    getAllIngestionWorkflows();
  }, [getAllIngestionWorkflows]);

  useEffect(() => {
    fetchCollateAgentsList();
  }, [fetchCollateAgentsList]);

  useEffect(() => {
    fetchWorkflowInstanceStates();
  }, [fetchWorkflowInstanceStates]);

  const handleTriggerAutopilot = useCallback(async () => {
    try {
      setIsAutopilotTriggering(true);
      await triggerOnDemandApp(AUTO_PILOT_APP_NAME, {
        entityLink: getEntityFeedLink(
          getEntityTypeFromServiceCategory(serviceCategory),
          serviceFqn
        ),
      });
      // Re-read the workflow state so the trigger sees the new run and stays disabled. The
      // governance engine may not have registered the instance by the first read, so retry a
      // bounded number of times — bounded, so a run that never materialises releases the button.
      for (
        let attempt = 1;
        attempt <= AUTO_PILOT_STATUS_READ_ATTEMPTS;
        attempt++
      ) {
        const mainInstanceState = await fetchWorkflowInstanceStates();
        if (mainInstanceState?.status === WorkflowStatus.Running) {
          break;
        }
        if (attempt < AUTO_PILOT_STATUS_READ_ATTEMPTS) {
          await new Promise((resolve) =>
            setTimeout(resolve, AUTO_PILOT_STATUS_READ_DELAY_MS)
          );
        }
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsAutopilotTriggering(false);
    }
  }, [serviceFqn, serviceCategory, fetchWorkflowInstanceStates]);

  const autoPilotAction: AutoPilotAction = useMemo(() => {
    const isRunning =
      workflowStatesData?.mainInstanceState.status === WorkflowStatus.Running;
    // AutoPilot deploys and triggers agents through the pipeline service, so it goes down with
    // it — the same rule the per-agent controls follow.
    let disabledMessage: string | undefined;
    if (isAgentActionUnavailable) {
      disabledMessage = t('message.pipeline-service-unreachable-agent-actions');
    }
    if (isRunning) {
      disabledMessage = t('message.auto-pilot-already-running');
    }

    return {
      onTrigger: handleTriggerAutopilot,
      isLoading: isAutopilotTriggering,
      isDisabled:
        isRunning ||
        isWorkflowStatusLoading ||
        isAgentActionPending ||
        isAgentActionUnavailable,
      disabledMessage,
    };
  }, [
    t,
    handleTriggerAutopilot,
    isAutopilotTriggering,
    isWorkflowStatusLoading,
    isAgentActionPending,
    isAgentActionUnavailable,
    workflowStatesData?.mainInstanceState.status,
  ]);

  // One list per click: refreshing Metadata must not refetch the AI automations and vice versa.
  // The page size is passed through so a refresh stays on the page size the user picked.
  const refreshAgentsList = useCallback(
    (agentListType: ServiceAgentSubTabs) => {
      if (agentListType === ServiceAgentSubTabs.COLLATE_AI) {
        fetchCollateAgentsList();
      } else {
        getAllIngestionWorkflows({}, ingestionPagingInfo.pageSize);
      }
    },
    [
      getAllIngestionWorkflows,
      fetchCollateAgentsList,
      ingestionPagingInfo.pageSize,
    ]
  );

  const agentCounts: Record<ServiceAgentSubTabs, number> = useMemo(
    () => ({
      // Stream-discovered agents render as cards before any refetch updates the paging total,
      // so count them on top of the last fetched total.
      [ServiceAgentSubTabs.METADATA]:
        (ingestionPagingInfo.paging.total ?? ingestionPipelines.length) +
        discoveredCount,
      [ServiceAgentSubTabs.COLLATE_AI]: collateAgentsList.length,
    }),
    [
      ingestionPagingInfo.paging.total,
      ingestionPipelines.length,
      discoveredCount,
      collateAgentsList.length,
    ]
  );

  return {
    agentCounts,
    autoPilotAction,
    collateAgentPagingInfo,
    collateAgentsList,
    ingestionPipelines,
    isCollateAgentLoading,
    isIngestionPipelineLoading,
    metadataAgents,
    refreshAgentsList,
    workflowStatesData,
  };
};

export type ServiceAgentsState = ReturnType<typeof useServiceAgents>;
