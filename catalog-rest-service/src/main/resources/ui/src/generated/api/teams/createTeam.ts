/**
 * Team entity
 */
export interface CreateTeam {
  /**
   * Optional description of the team
   */
  description?: string;
  /**
   * Optional name used for display purposes. Example 'Marketing Team'
   */
  displayName?: string;
  name: string;
  /**
   * Optional team profile information
   */
  profile?: Profile;
  /**
   * Optional IDs of users that are part of the team
   */
  users?: string[];
}

/**
 * Optional team profile information
 *
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
