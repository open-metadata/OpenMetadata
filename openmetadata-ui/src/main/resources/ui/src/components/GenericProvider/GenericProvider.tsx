import React, { useMemo } from 'react';
import { EntityType } from '../../enums/entity.enum';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';

interface GenericProviderProps<T extends GlossaryTerm> {
  children?: React.ReactNode;
  data: T;
  type: EntityType;
  onUpdate: (updatedData: T) => Promise<void>;
}

interface GenericContextType {
  data: unknown;
  type: EntityType;
  onUpdate: (updatedData: unknown) => Promise<void>;
}

const GenericContext = React.createContext<GenericContextType | undefined>(
  {} as GenericContextType
);

export const GenericProvider = <T extends GlossaryTerm>({
  children,
  data,
  type,
  onUpdate,
}: GenericProviderProps<T>) => {
  const typedData = data as T;
  const values = useMemo(
    () => ({ data: typedData, type, onUpdate }),
    [typedData, type, onUpdate]
  );

  return (
    <GenericContext.Provider value={values}>{children}</GenericContext.Provider>
  );
};

export const useGenericContext = <
  T extends { data: unknown; type: EntityType }
>() => React.useContext<T>(GenericContext);
