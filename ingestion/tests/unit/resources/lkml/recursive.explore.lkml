include: "views/recursive.view.lkml"

view: recursive_explore {

  dimension: dim {
    type: string
    sql: ${TABLE}.name ;;
  }
}
