# QuestDB

In this section, we provide guides and references to use the QuestDB connector.

## Requirements

QuestDB speaks the PostgreSQL wire protocol (default port `8812`). OpenMetadata connects through `psycopg2` and introspects metadata via QuestDB's `information_schema` views.

The user connecting to QuestDB must be able to read `information_schema.tables` and `information_schema.columns`. The built-in `admin` user has the required access by default.

You can find further information on the QuestDB connector in the <a href="https://docs.open-metadata.org/connectors/database/questdb" target="_blank">docs</a>.

## Connection Details

$$section
### Scheme $(id="scheme")

SQLAlchemy driver scheme options. QuestDB uses `postgresql+psycopg2` because it speaks the PostgreSQL wire protocol.
$$

$$section
### Username $(id="username")

Username to connect to QuestDB. The default QuestDB user is `admin`.
$$

$$section
### Auth Config $(id="authType")

QuestDB uses basic authentication (username + password).
$$

## Basic Auth

$$section
### Password $(id="password")

Password to connect to QuestDB. The default password for the `admin` user is `quest`.
$$

$$section
### Host and Port $(id="hostPort")

Host and port of the QuestDB service using the PostgreSQL wire protocol. The default port is `8812` (note: this is different from QuestDB's web console on port `9000`). Example: `localhost:8812`.
$$

$$section
### Database Name $(id="databaseName")

Optional display name for the QuestDB database in OpenMetadata. QuestDB exposes a single physical database (`qdb`); this value is used only for display and for building the fully qualified name. Defaults to `qdb` if left blank.
$$

$$section
### Connection Options $(id="connectionOptions")

Additional connection options to build the URL that can be sent to service during the connection.
$$

$$section
### Connection Arguments $(id="connectionArguments")

Additional connection arguments such as security or protocol configs that can be sent to service during connection.
$$

$$section
### Schema Filter Pattern $(id="schemaFilterPattern")

Regex to only include/exclude schemas that match the pattern. QuestDB exposes a single schema (`public`), so this is rarely needed.
$$

$$section
### Table Filter Pattern $(id="tableFilterPattern")

Regex to only include/exclude tables that match the pattern.
$$

$$section
### Database Filter Pattern $(id="databaseFilterPattern")

Regex to only include/exclude databases that match the pattern. QuestDB exposes a single database (`qdb`), so this is rarely needed.
$$
