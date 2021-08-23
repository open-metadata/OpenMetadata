
getTypes(){
    # echo "Method called! $1"
    dir=$1
    for f in $dir/*
    do
    # echo "$f"
    filename=$f
    if [[ -d $f ]];
    then
        getTypes "$f" "$2" "$3"
    else
        fileTS=${f//.json/.ts}
        fileTS=${fileTS//$2/$3}
        # echo $fileTS
        mkdir -p "$(dirname "$fileTS")" && quicktype -s schema "$f" -o "$fileTS" --just-types
    fi
    # cd ./$filename
    # ls
    # json2ts -i '*.json' -o '/home/shailesh/Desktop/work/jsontoty/types'
    # cd $2
    done
}

# cd $1
rm -r $2
mkdir $2
getTypes "$1" "$1" "$2"
# quicktype -s schema schema/*/*.json -o types1.d.ts --just-types