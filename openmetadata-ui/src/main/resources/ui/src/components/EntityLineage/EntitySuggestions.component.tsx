import { AxiosResponse } from 'axios';
import { capitalize } from 'lodash';
import { FormatedTableData } from 'Models';
import React, { FC, HTMLAttributes, useEffect, useState } from 'react';
import { getSuggestions } from '../../axiosAPIs/miscAPI';
import { SearchIndex } from '../../enums/search.enum';
import { EntityReference } from '../../generated/type/entityReference';
import { formatDataResponse } from '../../utils/APIUtils';

interface EntitySuggestionProps extends HTMLAttributes<HTMLDivElement> {
  onSelectHandler: (value: EntityReference) => void;
  entityType: string;
}

const EntitySuggestions: FC<EntitySuggestionProps> = ({
  entityType,
  onSelectHandler,
}) => {
  const [data, setData] = useState<Array<FormatedTableData>>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [searchValue, setSearchValue] = useState<string>('');

  useEffect(() => {
    getSuggestions(
      searchValue,
      SearchIndex[entityType as keyof typeof SearchIndex]
    ).then((res: AxiosResponse) => {
      setData(formatDataResponse(res.data.suggest['table-suggest'][0].options));
    });
  }, [searchValue]);

  useEffect(() => {
    setIsOpen(data.length > 0);
  }, [data]);

  return (
    <div>
      <input
        className="tw-form-inputs tw-px-3 tw-py-1 tw-w-full"
        placeholder={`Search for ${capitalize(entityType)}s...`}
        type="search"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
      />
      {data.length > 0 && isOpen ? (
        <div
          aria-labelledby="menu-button"
          aria-orientation="vertical"
          className="tw-origin-top-right tw-absolute tw-z-20
          tw-w-full tw-mt-1 tw-rounded-md tw-shadow-lg
        tw-bg-white tw-ring-1 tw-ring-black tw-ring-opacity-5 focus:tw-outline-none"
          role="menu">
          {data.map((entity) => (
            <div
              className="tw-flex tw-items-center hover:tw-bg-body-hover"
              key={entity.fullyQualifiedName}>
              <span
                className="tw-block tw-px-2 tw-py-2 tw-text-sm tw-break-all"
                onClick={() => {
                  setIsOpen(false);
                  onSelectHandler?.({
                    description: entity.description,
                    displayName: entity.name,
                    id: entity.id,
                    type: entity.entityType as string,
                    name: entity.name,
                  });
                }}>
                {entity.database
                  ? `${entity.database}/${entity.name}`
                  : entity.name}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default EntitySuggestions;
