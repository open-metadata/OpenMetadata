include: "views/cats.view.lkml"

view: kittens {
  extends: [cats]

  dimension: parent {
    type: string
    sql: ${TABLE}.name ;;
  }
}
