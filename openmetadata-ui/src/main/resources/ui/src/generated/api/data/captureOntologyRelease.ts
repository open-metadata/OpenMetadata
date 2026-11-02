/**
 * Capture one committed working revision as an immutable ontology release candidate.
 */
export interface CaptureOntologyRelease {
    /**
     * Optional activation revision observed with the working diff.
     */
    expectedActivationRevision?: number;
    /**
     * Latest release revision observed by the caller. Required when versionBump is supplied.
     */
    expectedLatestReleaseRevision?: number;
    expectedWorkingRevision:        number;
    releaseNotes?:                  string;
    /**
     * Allocate the next semantic version from the active release. The unversioned base is 0.0.0.
     */
    versionBump?: VersionBump;
}

/**
 * Allocate the next semantic version from the active release. The unversioned base is 0.0.0.
 */
export enum VersionBump {
    Major = "major",
    Minor = "minor",
    Patch = "patch",
}
