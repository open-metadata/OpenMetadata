import { mergeConfig } from 'vite';
import base from '/Users/rohitjain/conductor/workspaces/OpenMetadata/sparta/openmetadata-ui/src/main/resources/ui/vite.config.ts';
const C = '/Users/rohitjain/conductor/workspaces/OpenMetadata/sparta/openmetadata-ui-core-components/src/main/resources/ui';
const map = { colors: 'colors/index.es.js', components: 'components/index.es.js', utils: 'utils/index.es.js', locale: 'locale/index.es.js', icons: 'icons/index.es.js', icon: 'icon/index.es.js', charts: 'charts/index.es.js' };
export default async (env) => {
  const cfg = typeof base === 'function' ? await base(env) : base;
  return mergeConfig(cfg, {
    resolve: {
      alias: [
        { find: /^@openmetadata\/ui-core-components\/globals\.css$/, replacement: `${C}/src/styles/globals.css` },
        ...Object.entries(map).map(([k, v]) => ({ find: new RegExp(`^@openmetadata/ui-core-components/${k}$`), replacement: `${C}/dist/${v}` })),
        { find: /^@openmetadata\/ui-core-components$/, replacement: `${C}/dist/index.es.js` },
      ],
    },
    optimizeDeps: { exclude: ['@openmetadata/ui-core-components'] },
  });
};
