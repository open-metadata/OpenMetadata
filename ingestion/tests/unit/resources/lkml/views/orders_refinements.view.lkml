view: +orders {
  sql_table_name: analytics.orders_clean ;;

  dimension: status {
    type: string
    sql: ${TABLE}.status ;;
  }
}
