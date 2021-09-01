/**
 * Create thread request
 */
export interface CreateThread {
  /**
   * Data asset about which this thread is created for with format
   * <#E/{enties}/{entityName}/{field}/{fieldValue}
   */
  about: string;
  /**
   * ID of User (regular user or bot) posting the message
   */
  from: string;
  /**
   * Message
   */
  message: string;
}
