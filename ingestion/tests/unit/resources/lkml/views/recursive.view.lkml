include: "views/recursive_call.view.lkml"

view: recursive {

  dimension: dim {
    type: string
    sql: ${TABLE}.name ;;
  }
}
