Based on the language settings, if the required plugin is not found, you will get an error. Below are the general steps to install the necessary plugins for Elasticsearch and OpenSearch, with specific examples for the currently supported versions:

#### For Elasticsearch:

- **Chinese (ZH) Language Support:**
  Install the `analysis-ik` plugin to support Chinese language indexing. Replace `<version>` with your Elasticsearch version.
  ```sh
  bin/elasticsearch-plugin install https://get.infini.cloud/elasticsearch/analysis-ik/<version>
  ```
  **Example for 8.10.2:**
  ```sh
  bin/elasticsearch-plugin install https://get.infini.cloud/elasticsearch/analysis-ik/8.10.2
  ```

- **Japanese (JP) Language Support:**
  Install the `analysis-kuromoji` plugin to support Japanese language indexing. Replace `<version>` with your Elasticsearch version.
  ```sh
  bin/elasticsearch-plugin install --batch https://artifacts.elastic.co/downloads/elasticsearch-plugins/analysis-kuromoji/analysis-kuromoji-<version>.zip
  ```

**Example for 8.10.2:**
```sh
bin/elasticsearch-plugin install --batch https://artifacts.elastic.co/downloads/elasticsearch-plugins/analysis-kuromoji/analysis-kuromoji-8.10.2.zip
```

Please restart ElasticSearch to activate any plugins installed. Perform `reindexing` after installing the plugins

#### For OpenSearch:

Currently, there is no official support for the below plugins. Below are the general commands for installing available plugins, with examples for the currently supported version. Note that these plugins might encounter errors, and there are open GitHub issues regarding this.

- **Chinese (ZH) Language Support:**
  Replace `<version>` with your OpenSearch version.
  ```sh
  opensearch-plugin install --batch https://github.com/aparo/opensearch-analysis-ik/releases/download/<version>/opensearch-analysis-ik.zip
  ```

**Example for 2.15.0:**
```sh
opensearch-plugin install --batch https://github.com/aparo/opensearch-analysis-ik/releases/download/2.15.0/opensearch-analysis-ik.zip
```

- **Japanese (JP) Language Support:**
  Replace `<version>` with your OpenSearch version.
  ```sh
  opensearch-plugin install --batch https://artifacts.opensearch.org/releases/plugins/analysis-kuromoji/<version>/analysis-kuromoji-<version>.zip
  ```

**Example for 2.15.0:**
```sh
opensearch-plugin install --batch https://artifacts.opensearch.org/releases/plugins/analysis-kuromoji/2.15.0/analysis-kuromoji-2.15.0.zip
```

Please restart OpenSearch to activate any plugins installed. Perform `reindexing` after installing the plugins

---
