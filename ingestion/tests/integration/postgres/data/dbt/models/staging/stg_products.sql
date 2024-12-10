with

source as (

    select * from {{ source('ecom', 'raw_products') }}

),

renamed as (

    select

        ----------  ids
        sku as product_id,

        ---------- text
        name as product_name,
        type as product_type,
        description as product_description,


        ---------- numerics
        {{ cents_to_dollars('price') }} as product_price,

        ---------- booleans
        coalesce(type = 'jaffle', false) as is_food_item,

        coalesce(type = 'beverage', false) as is_drink_item

    from source

)

select * from renamed
