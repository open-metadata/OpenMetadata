import { defineConfig } from 'vitepress'

// @ts-expect-error - sidebar.json is generated at build time
import sidebar from '../docs/sidebar.json'

export default defineConfig({
  title: "OpenMetadata E2E",
  description: "End-to-End Test Documentation",
  srcDir: 'docs', // Important: Pointing to the generated docs folder
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Components', link: '/components/' }
    ],

    sidebar: {
      '/components/': sidebar
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/open-metadata/OpenMetadata' }
    ],
    
    search: {
      provider: 'local'
    }
  }
})
