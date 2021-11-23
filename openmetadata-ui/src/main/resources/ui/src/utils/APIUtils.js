import { orderBy } from 'lodash';
import { getTableDetails } from '../axiosAPIs/tableAPI';
import { getRelativeTime } from './TimeUtils';

// if more value is added, also update its interface file at -> interface/types.d.ts
export const formatDataResponse = (hits) => {
  const formattedData = hits.map((hit) => {
    const newData = {};
    newData.index = hit._index;
    newData.id =
      hit._source.table_id ||
      hit._source.topic_id ||
      hit._source.dashboard_id ||
      hit._source.pipeline_id;
    newData.name =
      hit._source.table_name ||
      hit._source.topic_name ||
      hit._source.dashboard_name ||
      hit._source.pipeline_name;
    newData.description = hit._source.description;
    newData.fullyQualifiedName = hit._source.fqdn;
    newData.tableType = hit._source.table_type;
    newData.tags = hit._source.tags;
    newData.dailyStats = hit._source.daily_stats;
    newData.dailyPercentileRank = hit._source.daily_percentile_rank;
    newData.weeklyStats = hit._source.weekly_stats;
    newData.weeklyPercentileRank = hit._source.weekly_percentile_rank;
    newData.service = hit._source.service;
    newData.serviceType = hit._source.service_type;
    newData.tableEntity = hit._source.table_entity;
    newData.tier = hit._source.tier;
    newData.owner = hit._source.owner;
    newData.highlight = hit.highlight;

    return newData;
  });

  return formattedData;
};

const formatPost = (post) => {
  return {
    title: post.from,
    timestamp: post.postTs,
    relativeTime: getRelativeTime(post.postTs),
    message: post.message,
  };
};

export const formatFeedDataResponse = (feedData) => {
  const formattedFeed = orderBy(feedData, ['threadTs'], ['desc']).map(
    (feed) => {
      const { id: toEntity, type: entity } = feed.toEntity;
      const { title, timestamp, relativeTime, message } = formatPost(
        feed.posts[0]
      );
      const newFeed = {
        title,
        timestamp,
        relativeTime,
        toEntity,
        entity,
        message,
      };
      newFeed.subThreads = feed.posts.slice(1).map((post) => {
        return formatPost(post);
      });
      newFeed.threadId = feed.id;

      return newFeed;
    }
  );

  return formattedFeed;
};

export const getDateFromTimestamp = (ts) => {
  const newDate = new Date(ts);
  let day = newDate.getDate();
  let month = newDate.getMonth() + 1;
  const year = newDate.getFullYear();
  switch (day) {
    case 1:
    case 21:
    case 31: {
      day = `${day}st`;

      break;
    }
    case 2:
    case 22: {
      day = `${day}nd`;

      break;
    }
    case 3:
    case 23: {
      day = `${day}rd`;

      break;
    }
    default: {
      day = `${day}th`;
    }
  }

  switch (month) {
    case 1: {
      month = 'Jan';

      break;
    }
    case 2: {
      month = 'Feb';

      break;
    }
    case 3: {
      month = 'Mar';

      break;
    }
    case 4: {
      month = 'Apr';

      break;
    }
    case 5: {
      month = 'May';

      break;
    }
    case 6: {
      month = 'Jun';

      break;
    }
    case 7: {
      month = 'Jul';

      break;
    }
    case 8: {
      month = 'Aug';

      break;
    }
    case 9: {
      month = 'Sep';

      break;
    }
    case 10: {
      month = 'Oct';

      break;
    }
    case 11: {
      month = 'Nov';

      break;
    }
    case 12: {
      month = 'Dec';

      break;
    }
    default: {
      break;
    }
  }

  let hours = newDate.getHours();
  const amPm = hours >= 12 ? 'PM' : 'AM';
  hours = hours > 12 ? hours - 12 : hours;
  let minutes = newDate.getMinutes();

  hours = hours.toString().length === 1 ? `0${hours}` : hours.toString();
  minutes =
    minutes.toString().length === 1 ? `0${minutes}` : minutes.toString();

  return `${day} ${month} ${year} ${hours}:${minutes} ${amPm}`;
};

export const getEntityByTypeAndId = (id, entityType) => {
  // const {entityType, id} = entity;
  switch (entityType) {
    case 'Table': {
      return getTableDetails(id);
    }
    default: {
      return getTableDetails(id);
    }
  }
};

export const getURLWithQueryFields = (url, lstQueryFields) => {
  let strQuery = lstQueryFields
    ? typeof lstQueryFields === 'string'
      ? lstQueryFields
      : lstQueryFields.length
      ? lstQueryFields.join()
      : ''
    : '';
  strQuery = strQuery.replace(/ /g, '');

  return url + (strQuery ? `?fields=${strQuery}` : '');
};
