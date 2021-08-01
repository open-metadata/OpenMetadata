import {
  MYSQL,
  REDSHIFT,
  BIGQUERY,
  HIVE,
  POSTGRES,
  ORACLE,
  SNOWFLAKE,
} from '../constants/services.const';
import { ServiceType } from '../enums/service.enum';

export const serviceTypeLogo = (type: string) => {
  switch (type) {
    case ServiceType.MYSQL:
      return MYSQL;

    case ServiceType.REDSHIFT:
      return REDSHIFT;

    case ServiceType.BIGQUERY:
      return BIGQUERY;

    case ServiceType.HIVE:
      return HIVE;

    case ServiceType.POSTGRES:
      return POSTGRES;

    case ServiceType.ORACLE:
      return ORACLE;

    case ServiceType.SNOWFLAKE:
      return SNOWFLAKE;

    default:
      return MYSQL;
  }
};
