import React, { useMemo } from 'react';
import { ReactComponent as IconTerm } from '../../../assets/svg/book.svg';
import { ReactComponent as GlossaryIcon } from '../../../assets/svg/glossary.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { EntityType } from '../../../enums/entity.enum';
import { WidgetCommonProps } from '../../../pages/CustomizablePage/CustomizablePage.interface';
import { EntityHeader } from '../../Entity/EntityHeader/EntityHeader.component';

export const GlossaryHeaderWidget = ({ isEditView }: WidgetCommonProps) => {
  const isGlossary = false;

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

  if (!isEditView) {
    return null;
  }

  return (
    <div className="p-x-md p-y-sm">
      <EntityHeader
        breadcrumb={[
          { name: 'Glossaries', url: '#', activeTitle: false },
          { name: 'Glossary Term', url: '#', activeTitle: false },
        ]}
        entityData={{ name: 'Glossary Term' }}
        entityType={EntityType.GLOSSARY_TERM}
        icon={icon}
        serviceName=""
      />
    </div>
  );
};
