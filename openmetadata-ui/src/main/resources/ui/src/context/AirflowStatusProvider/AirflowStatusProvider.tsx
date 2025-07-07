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
import { AxiosError } from 'axios';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { PipelineServiceClientResponse } from '../../generated/entity/services/ingestionPipelines/pipelineServiceClientResponse';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { getAirflowStatus } from '../../rest/ingestionPipelineAPI';
import { AirflowStatusContextType } from './AirflowStatusProvider.interface';

export const AirflowStatusContext = createContext(
  {} as AirflowStatusContextType
);

interface Props {
  children: ReactNode;
}

const AirflowStatusProvider = ({ children }: Props) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAirflowAvailable, setIsAirflowAvailable] = useState<boolean>(false);
  const [error, setError] = useState<AxiosError>();
  const [reason, setReason] =
    useState<PipelineServiceClientResponse['reason']>();
  const [platform, setPlatform] =
    useState<PipelineServiceClientResponse['platform']>('unknown');
  const { currentUser } = useApplicationStore();

  const fetchAirflowStatus = useCallback(async () => {
    if (!currentUser?.id) {
      return;
    }
    setIsLoading(true);
    try {
      const response = await getAirflowStatus();
      setIsAirflowAvailable(response.code === 200);
      setReason(response.reason);
      setPlatform(response.platform);
    } catch (error) {
      setError(error as AxiosError);
      setIsAirflowAvailable(false);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    fetchAirflowStatus();
  }, [fetchAirflowStatus]);

  const value: AirflowStatusContextType = useMemo(
    () => ({
      isFetchingStatus: isLoading,
      isAirflowAvailable,
      error,
      reason,
      platform,
      fetchAirflowStatus,
    }),
    [isLoading, isAirflowAvailable, error, reason, platform, fetchAirflowStatus]
  );

  return (
    <AirflowStatusContext.Provider value={value}>
      {children}
    </AirflowStatusContext.Provider>
  );
};

export const useAirflowStatus = () => useContext(AirflowStatusContext);

export default AirflowStatusProvider;
