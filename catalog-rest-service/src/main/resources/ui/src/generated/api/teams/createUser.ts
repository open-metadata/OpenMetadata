/**
 * Request to create User entity
 */
export interface CreateUser {
  /**
   * Name used for display purposes. Example 'FirstName LastName'
   */
  displayName?: string;
  email: string;
  /**
   * When true indicates user is an adiministrator for the sytem with superuser privileges
   */
  isAdmin?: boolean;
  /**
   * When true indicates user is a bot with appropriate privileges
   */
  isBot?: boolean;
  name: string;
  profile?: Profile;
  /**
   * Teams that the user belongs to
   */
  teams?: string[];
  /**
   * Timezone of the user
   */
  timezone?: string;
}

/**
 * This schema defines the type for a profile of a user, team, or organization.
 */
export interface Profile {
  images?: ImageList;
}

/**
 * Links to a list of images of varying resolutions/sizes.
 */
export interface ImageList {
  image?: string;
  image192?: string;
  image24?: string;
  image32?: string;
  image48?: string;
  image512?: string;
  image72?: string;
}
