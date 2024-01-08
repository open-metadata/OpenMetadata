update field_relationship fr INNER JOIN  user_entity ue on fr.fromFQN=ue.name
    set fr.fromFQNHASH=MD5(JSON_UNQUOTE(JSON_EXTRACT(ue.json, '$.fullyQualifiedName'))),
    fr.fromFQN=JSON_UNQUOTE(JSON_EXTRACT(ue.json, '$.fullyQualifiedName'))  where fr.fromType='user';