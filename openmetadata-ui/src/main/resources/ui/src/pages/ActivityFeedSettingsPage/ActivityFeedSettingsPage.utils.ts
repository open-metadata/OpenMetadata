import { xor } from 'lodash';
import { EventFilter, EventType } from '../../generated/settings/settings';

export const getEventFilterFromTree = (
  updatedTree: Record<string, string[]>,
  eventFilters: EventFilter[]
): EventFilter[] => {
  return eventFilters.map((eventFilter) => ({
    ...eventFilter,
    filters: eventFilter.filters?.map((filter) => {
      let includeList = filter.include;
      let excludeList = filter.exclude;

      // derive the merge list
      const mergedList = [
        ...(includeList as string[]),
        ...(excludeList as string[]),
      ];

      // manipulate tree if event type is present
      if (updatedTree[eventFilter.entityType]) {
        // Split the value to get list of [eventType, filter, event]
        const temp = updatedTree[eventFilter.entityType].map((key) =>
          key.split('-')
        );

        // grab the list of current eventType
        const eventList = temp.filter((f) => f[1] === filter.eventType);

        if (eventList.length > 0) {
          if (filter.eventType === EventType.EntityUpdated) {
            // derive include list based on selected events
            includeList = eventList.map((f) => f[2]).filter(Boolean);

            // derive the exclude list by symmetric difference
            excludeList = xor(mergedList, includeList);
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
