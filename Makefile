# EMBER root: the integration stack plus pass-through targets for the two apps.
# On Windows use `mingw32-make` if `make` is missing.
.PHONY: help up down logs ps backend-% frontend-%

help:
	@echo "make up              build and start db + backend + frontend (docker compose)"
	@echo "make down            stop the stack (data volumes are kept)"
	@echo "make logs / ps       follow logs / list services"
	@echo "make backend-<t>     run 'make <t>' in backend/   (e.g. backend-dev, backend-contract-check)"
	@echo "make frontend-<s>    run 'npm run <s>' in frontend/ (e.g. frontend-dev, frontend-lint)"

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f

ps:
	docker compose ps

backend-%:
	$(MAKE) -C backend $*

frontend-%:
	npm --prefix frontend run $*
