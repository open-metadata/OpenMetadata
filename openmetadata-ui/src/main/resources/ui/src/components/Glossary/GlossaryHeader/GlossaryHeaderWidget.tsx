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
import { useMemo } from 'react';
import { ReactComponent as IconTerm } from '../../../assets/svg/book.svg';
import { ReactComponent as GlossaryIcon } from '../../../assets/svg/glossary.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { EntityHeader } from '../../Entity/EntityHeader/EntityHeader.component';

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
          height={36}
          name="folder"
          width={32}
        />
      );
    }

    return (
      <IconTerm
        className="align-middle"
        color={DE_ACTIVE_COLOR}
        height={36}
        name="doc"
        width={32}
      />
    );
  }, [isGlossary]);

  return (
    <div className="p-x-md p-y-sm">
      <EntityHeader
        showName
        breadcrumb={[
          { name: 'Glossaries', url: '#', activeTitle: false },
          { name: 'Glossary Term', url: '#', activeTitle: false },
        ]}
        entityData={{ name: 'Glossary Term', displayName: 'Glossary Term' }}
        entityType={EntityType.GLOSSARY_TERM}
        icon={icon}
        serviceName=""
      />
    </div>
  );
};
