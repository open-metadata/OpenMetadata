import { intersection, isEmpty, isUndefined, xor } from 'lodash';
import {
  EventFilter,
  EventType,
  Filters,
} from '../../generated/settings/settings';
import { getDiffArray } from '../../utils/CommonUtils';

export const getPayloadFromSelected = (
  selectedOptions: Record<string, string[]>,
  selectedKey: string,
  selectedEntityEventUpdatedFields: string[]
): void | Array<Filters> => {
  const nonUpdatedFields = [] as string[];
  const resultArr = [];

  if (
    isUndefined(selectedOptions) &&
    isEmpty(selectedKey) &&
    selectedEntityEventUpdatedFields
  ) {
    return [] as Filters[];
  }

  if (selectedKey && Object.keys(selectedOptions).includes(selectedKey)) {
    const arr = Object.entries(selectedOptions).map(([, value]) => {
      return (
        value &&
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        value.reduce((valueAcc: any, name: string) => {
          const selected = name.split('-');

          if (selected[1] !== EventType.EntityUpdated) {
            return [
              ...valueAcc,
              {
                eventType: selected[1],
                include: ['all'],
                exclude: [],
              },
            ];
          } else {
            nonUpdatedFields.push(selected[2]);

            return valueAcc;
          }
        }, [])
      );
    });
    resultArr.push(...arr[0]);

    if (!isUndefined(nonUpdatedFields) && !isEmpty(nonUpdatedFields)) {
      const selectedUpdatedData = nonUpdatedFields.filter(
        (name) => !isUndefined(name) || (!isEmpty(name) && name)
      );

      resultArr.push({
        eventType: EventType.EntityUpdated,
        include: selectedUpdatedData,
        exclude: getDiffArray(
          selectedEntityEventUpdatedFields,
          selectedUpdatedData
        ),
      });
    }

    return resultArr as Filters[];
  }
};

export const getEventFilterFromTree = (
  updatedTree: Record<string, string[]>,
  eventFilters: EventFilter[]
): EventFilter[] => {
  return eventFilters.map((eventFilter) => ({
    ...eventFilter,
    filters: eventFilter.filters?.map((filter) => {
      let includeList = filter.include;
      let excludeList = filter.exclude;
      if (updatedTree[eventFilter.entityType]) {
        const temp = updatedTree[eventFilter.entityType].map((key) =>
          key.split('-')
        );

        const eventList = temp.filter((f) => f[1] === filter.eventType);
        if (eventList.length > 0) {
          if (filter.eventType === EventType.EntityUpdated) {
            includeList = intersection(
              filter.include ?? [],
              eventList.map((f) => f[2])
            );
            excludeList = xor(filter.include, includeList);
          } else {
            includeList = ['all'];
            excludeList = [];
          }
        } else {
          excludeList = [...(includeList ?? []), ...(excludeList ?? [])];
          includeList = [];
        }
      }

      return {
        ...filter,
        include: includeList,
        exclude: excludeList,
      };
    }),
  }));
};
