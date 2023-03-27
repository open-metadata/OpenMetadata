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