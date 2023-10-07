view: cats {
  sql_table_name: cats ;;

  dimension: name {
    type: string
    sql: ${TABLE}.name ;;
  }

  dimension: age {
    type: int
    sql: ${TABLE}.age ;;
  }
}
