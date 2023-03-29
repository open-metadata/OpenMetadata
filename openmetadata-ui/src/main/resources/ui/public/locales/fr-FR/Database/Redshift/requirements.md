# Exigences
L'utilisateur Redshift doit avoir la permission d'exécuter les requêtes `SELECT` sur la table `SVV_TABLE_INFO` pour permettre a OpenMetadata d'obtenir les metadonnées des tables et des vues.

```sql
CREATE USER test_user with PASSWORD 'password';
GRANT SELECT ON TABLE svv_table_info to test_user;
```

Si vous voulez exécuter le profilage et les testes vous devez vous assurer que l'utilisateur utilisé pour le service petu exécuter des requêtes `SELECT` sur les tables et vues. Pour plus d'information vous pouvez visiter la documentation Redshift [ici](https://docs.aws.amazon.com/redshift/latest/dg/c_visibility-of-data.html).

Vous pourrez également trouver plus de détails dans la [section Redshift](https://docs.open-metadata.org/connectors/database/redshift) de la documentation.