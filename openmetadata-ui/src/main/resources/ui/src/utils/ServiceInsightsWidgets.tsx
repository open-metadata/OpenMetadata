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
import React from 'react';
import AgentsStatusWidget from '../components/ServiceInsights/AgentsStatusWidget/AgentsStatusWidget';
import PlatformInsightsWidget from '../components/ServiceInsights/PlatformInsightsWidget/PlatformInsightsWidget';
import TotalDataAssetsWidget from '../components/ServiceInsights/TotalDataAssetsWidget/TotalDataAssetsWidget';
import MetadataAgentsWidget from '../components/Settings/Services/Ingestion/MetadataAgentsWidget/MetadataAgentsWidget';

export const getDefaultInsightsWidgets = (): Record<
  string,
  React.ComponentType<any>
> => ({
  AgentsStatusWidget,
  PlatformInsightsWidget,
  TotalDataAssetsWidget,
});

export const getDefaultAgentsTabWidgets = (): Record<
  string,
  React.ComponentType<any>
> => ({
  MetadataAgentsWidget,
});
