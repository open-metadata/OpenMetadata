/**
 * This schema defines Bot entity. A bot automates tasks, such as adding description,
 * identifying the importance of data. It runs as a special user in the system.
 */
export interface Bots {
  /**
   * Description of the bot.
   */
  description?: string;
  /**
   * Name used for display purposes. Example 'FirstName LastName'.
   */
  displayName?: string;
  /**
   * Link to the resource corresponding to this bot.
   */
  href?: string;
  /**
   * Unique identifier of a bot instance.
   */
  id?: string;
  /**
   * Name of the bot.
   */
  name?: string;
}
