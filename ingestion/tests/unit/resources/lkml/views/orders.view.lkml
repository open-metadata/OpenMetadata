view: orders {
  sql_table_name: raw.orders ;;

  dimension: id {
    type: string
    sql: ${TABLE}.id ;;
  }
}
