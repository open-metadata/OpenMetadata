update field_relationship fr
    set fromFQNHASH=MD5(ue.json->>'fullyQualifiedName'),
        fromFQN=ue.json->>'fullyQualifiedName' from user_entity ue where fr.fromType='user' and fr.fromFQN=ue.name;