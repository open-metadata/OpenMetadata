include: "views/kittens.view.lkml"
include: "views/dogs.view.lkml"

explore: kittens {
  label: "Kittens"
  join: dogs {
    relationship: many_to_one
    sql_on: ${kittens.name} = ${kittens.name} ;;
  }
}

