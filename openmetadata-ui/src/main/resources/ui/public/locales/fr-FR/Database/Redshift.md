# Redshift

In this section, we provide guides and references to use the Redshift connector.

# Exigences
L'utilisateur Redshift doit avoir la permission d'exécuter les requêtes `SELECT` sur la table `SVV_TABLE_INFO` pour permettre a OpenMetadata d'obtenir les metadonnées des tables et des vues.

```sql
CREATE USER test_user with PASSWORD 'password';
GRANT SELECT ON TABLE svv_table_info to test_user;
```

Si vous voulez exécuter le profilage et les testes vous devez vous assurer que l'utilisateur utilisé pour le service petu exécuter des requêtes `SELECT` sur les tables et vues. Pour plus d'information vous pouvez visiter la documentation Redshift [ici](https://docs.aws.amazon.com/redshift/latest/dg/c_visibility-of-data.html).

Vous pourrez également trouver plus de détails dans la [section Redshift](https://docs.open-metadata.org/connectors/database/redshift) de la documentation.

## Connection Details

### Scheme $(id="scheme")

Option pour le pilote SQLAlchemy

### Username $(id="username")

Le nom d'utilsateur pour se connecter à la base de données Redshift. Cet utilisateur doit pouvoir exécuter, à minima, des requêtes `SELECT` sur la table `SVV_TABLE_INFO`.

### Password $(id="password")

Mot de passe pour se connecter à Redshift.

### Host Port $(id="hostPort")

Hôte et port du cluster Redshift

### Database $(id="database")

La base de données Redshift à laquelle le service se connectera. Si vous souhaitez ingérer les métadonnées de plusieurs base de données, veuillez selectionner `ingestAllDatabases`.

### Ingest All Databases $(id="ingestAllDatabases")

Si selectionné, le flux de travail pourra ingérer les métadonnées de toutes les base de données dans votre cluster Redshift. 

### Ssl Mode $(id="sslMode")

Mode SSL pour se connecter a la base de données Redshift (e.g. `prefer`, `verify-ca`, etc.)

