view: dogs {
  sql_table_name: dogs ;;

  dimension: name {
    type: string
    sql: ${TABLE}.name ;;
  }

  dimension: age {
    type: number
    sql: ${TABLE}.age ;;
  }

  dimension: ball {
    type: yesno
    sql: ${TABLE}.ball ;;
  }
}
