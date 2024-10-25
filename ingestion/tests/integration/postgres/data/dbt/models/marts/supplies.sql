with

supplies as (

    select * from {{ ref('stg_supplies') }}

)

select * from supplies
