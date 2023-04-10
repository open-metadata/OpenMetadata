# Oracle

In this section, we provide guides and references to use the Oracle connector.

# Exigences
L'utilisateur doit avoir la permission d'exécuter des requêtes `CREATE SESSION` pour pouvoir aller chercher les métadonnées des tables et vues Oracle.

```sql
-- CREATE USER
CREATE USER user_name IDENTIFIED BY admin_password;

-- CREATE ROLE
CREATE ROLE new_role;

-- GRANT ROLE TO USER
GRANT new_role TO user_name;

-- GRANT CREATE SESSION PRIVILEGE TO USER
GRANT CREATE SESSION TO new_role;
```

**Important:** OpenMetadata utilise `python-oracledb` qui supoorte seulement les version 12c, 18c, 19c, et 21c d'Oracle.

Vous pourrez également trouver plus de détails dans la [section Oracle](https://docs.open-metadata.org/connectors/database/oracle) de la documentation.

## Connection Details

### Scheme $(id="scheme")

Option pour le pilote pour SQLAlchemy

### Username $(id="username")

Nom d'utilisateur pour se connecter à Oracle. Cet utilisateur doit avoir la permission d'exécuter des requêtes `CREATE SESSION`.

### Password $(id="password")

Le mot de passe pour se connecter à Oracle

### Host Port $(id="hostPort")

Hôte et port de la base de données Oracle.

### Instant Client Directory $(id="instantClientDirectory")

Ce dossier sera utilisé pour créer la variable d'environement `LD_LIBRARY_PATH`. Ce champs est requit si vous souhaitez utiliser le mode "thick" de connection. Par default, OpenMetadat utilise "instant client 19" et utilise le dossier `/instantclient`.

