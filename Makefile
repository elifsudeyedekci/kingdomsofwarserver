.PHONY: install dev stop

install:
	@cd admin-backend && npm install
	@cd admin-panel && npm install
	@cd landing-website && npm install

dev:
	@echo "Starting dev servers..."
	@cd admin-backend && npm run start:dev &
	@cd admin-panel && npm run dev &
	@cd landing-website && npm run dev &
	@echo "Services started. Use 'make stop' to stop."

stop:
	@bash scripts/hooks/session-stop.sh
	@pkill -f "nest start" || true
	@pkill -f "next dev" || true
	@echo "All services stopped."
