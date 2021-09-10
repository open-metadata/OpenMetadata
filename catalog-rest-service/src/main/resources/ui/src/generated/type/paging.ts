/**
 * Type used for cursor based pagination information in GET list responses.
 */
export interface Paging {
  /**
   * After cursor used for getting the next page (see API pagination for details).
   */
  after?: string;
  /**
   * Before cursor used for getting the previous page (see API pagination for details).
   */
  before?: string;
  /**
   * Total number of entries available to page through.
   */
  total: number;
}
