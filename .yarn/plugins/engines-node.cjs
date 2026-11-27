// Yarn 4 ignores `engines`, but ADR:2026-10-22-ui-nvmrc-is-the-one-node-pin relies on
// `yarn install` refusing a Node older than `engines.node`. This restores that check.
module.exports = {
  name: 'engines-node',
  factory: (require) => {
    const { MessageName } = require('@yarnpkg/core');
    const semver = require('semver');

    return {
      hooks: {
        validateProject(project, report) {
          const range = project.topLevelWorkspace.manifest.raw.engines?.node;
          // includePrerelease: a Node RC or nightly above the floor still satisfies the range.
          if (range && !semver.satisfies(process.version, range, { includePrerelease: true })) {
            report.reportError(
              MessageName.UNNAMED,
              `Node ${process.version} does not satisfy engines.node "${range}". Run: nvm install`
            );
          }
        },
      },
    };
  },
};
