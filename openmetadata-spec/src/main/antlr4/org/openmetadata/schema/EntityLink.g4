grammar EntityLink;

entitylink
    : RESERVED_START (separator entity_type separator name_or_fqn)+
      (separator entity_field (separator name_or_fqn)*)* '>' EOF
    ;


entity_type
    : SEGMENT # entityType
    ;

name_or_fqn
    : SEGMENT # nameOrFQN
    ;

entity_field
    : SEGMENT # entityField
    ;


separator
    : '::'
    ;

RESERVED_START
    : '<#E'
    ;

SEGMENT
    : SEGMENT_PART ( '>' SEGMENT_PART )*
    ;

fragment SEGMENT_PART
    : ( ~[:>] | ':' ~[:] )+
    ;
