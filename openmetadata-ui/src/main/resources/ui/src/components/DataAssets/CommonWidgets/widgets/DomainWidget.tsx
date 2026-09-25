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
import { lazy } from 'react';
import withSuspenseFallback from '../../../AppRouter/withSuspenseFallback';
import { useGenericContext } from '../../../Customization/GenericProvider/GenericContext';
import { CommonWidgetComponent, GenericEntity } from '../CommonWidgets.types';

const DomainLabelV2 = withSuspenseFallback(
  lazy(() =>
    import('../../DomainLabelV2/DomainLabelV2').then((m) => ({
      default: m.DomainLabelV2,
    }))
  )
);

export const DomainWidget: CommonWidgetComponent = () => {
  const { entityRules } = useGenericContext<GenericEntity>();

  return (
    <DomainLabelV2
      showDomainHeading
      multiple={entityRules.canAddMultipleDomains}
    />
  );
};
