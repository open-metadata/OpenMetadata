/**
 * This schema defines the type used for JDBC connection information.
 */
export interface JDBCConnection {
  /**
   * JDBC connection URL.
   */
  connectionUrl: string;
  /**
   * JDBC driver class.
   */
  driverClass: string;
  /**
   * Login password.
   */
  password: string;
  /**
   * Login user name.
   */
  userName: string;
}
