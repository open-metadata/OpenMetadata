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
import { TableExecutionSource } from '../../../../generated/type/tableExecutionSource';
import { formatDateTimeLong } from '../../../../utils/date-time/DateTimeUtils';
import { ExecutionSource } from './ExecutionSource';

interface ProfileExecutionHistoryProps {
  profiles: { timestamp: number; executionSource?: TableExecutionSource }[];
  isSharded: boolean;
}

export const ProfileExecutionHistory = ({
  profiles,
  isSharded,
}: ProfileExecutionHistoryProps) => {
  const visible = profiles.filter(
    (profile) => isSharded || profile.executionSource
  );

  if (visible.length === 0) {
    return null;
  }

  return (
    <ul>
      {visible.map((profile) => (
        <li key={profile.timestamp}>
          {formatDateTimeLong(profile.timestamp)}:{' '}
          <ExecutionSource
            isSharded={isSharded}
            source={profile.executionSource}
          />
        </li>
      ))}
    </ul>
  );
};
