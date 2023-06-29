include: "*/cats.view"
include: "views/dogs.view.lkml"


explore: cats {
  label: "Cats"
  join: dogs {
    relationship: many_to_one
    sql_on: ${cats.name} = ${dogs.name} ;;
  }
}

view: birds {
  sql_table_name: birds ;;

  dimension: name {
    type: string
    sql: ${TABLE}.name ;;
  }
}


explore: birds {
  label: "Birds"
  join: dogs {
    relationship: many_to_one
    sql_on: ${cats.name} = ${birds.name} ;;
  }
}
