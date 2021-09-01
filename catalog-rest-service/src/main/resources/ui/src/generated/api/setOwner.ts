/**
 * Set ownership for a given entity
 */
export interface SetOwner {
  /**
   * Id of the owner of the entity
   */
  id?: string;
  /**
   * Entity type of the owner typically either 'user' or 'team'
   */
  type?: string;
}
