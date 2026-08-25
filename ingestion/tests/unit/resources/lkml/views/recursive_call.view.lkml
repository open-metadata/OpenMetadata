include: "views/recursive.view.lkml"

view: recursive_call {

  dimension: dim2 {
    type: string
    sql: ${TABLE}.name ;;
  }
}
