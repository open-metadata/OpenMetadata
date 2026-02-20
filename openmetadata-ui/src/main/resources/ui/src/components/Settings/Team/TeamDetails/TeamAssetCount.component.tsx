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
import { Skeleton, Typography } from 'antd';

interface TeamAssetCountProps {
  count: number | null;
  isLoading: boolean;
}

export const TeamAssetCount = ({ count, isLoading }: TeamAssetCountProps) => {
  if (isLoading) {
    return <Skeleton.Input active size="small" style={{ width: 30, height: 20 }} />;
  }

  return <Typography.Text data-testid="asset-count">{count ?? 0}</Typography.Text>;
};
