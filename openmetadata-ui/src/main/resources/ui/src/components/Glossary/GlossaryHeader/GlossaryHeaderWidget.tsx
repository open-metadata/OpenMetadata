/*
 *  Copyright 2024 Collate.
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
  Glossary as GlossaryIcon,
  GlossaryTerm as GlossaryTermIcon,
} from '@openmetadata/ui-core-components/icons';
import { useMemo } from 'react';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { EntityHeader } from '../../Entity/EntityHeader/EntityHeader.component';

const GLOSSARY_TERM = 'Glossary Term';

export const GlossaryHeaderWidget = ({
  isGlossary = true,
}: {
  isGlossary?: boolean;
}) => {
  const icon = useMemo(() => {
    if (isGlossary) {
      return (
        <GlossaryIcon
          className="align-middle"
          color={DE_ACTIVE_COLOR}
          size={36}
        />
      );
    }

    return (
      <GlossaryTermIcon
        className="align-middle"
        color={DE_ACTIVE_COLOR}
        size={36}
      />
    );
  }, [isGlossary]);

  return (
    <div className="p-x-md p-y-sm">
      <EntityHeader
        showName
        breadcrumb={[
          { name: 'Glossaries', url: '#', activeTitle: false },
          { name: GLOSSARY_TERM, url: '#', activeTitle: false },
        ]}
        entityData={{ name: GLOSSARY_TERM, displayName: GLOSSARY_TERM }}
        entityType={EntityType.GLOSSARY_TERM}
        icon={icon}
        serviceName=""
      />
    </div>
  );
};
