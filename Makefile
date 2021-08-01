.PHONY: env38 

env38:
#	virtualenv -p python3.8 env38
	python3.8 -m venv env38 
clean_env37:
	rm -rf env38
