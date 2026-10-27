#!/usr/bin/env bash
# Uruchamia schema.sql i testy na tymczasowym Postgresie (lub na istniejącym: PGHOST/PGPORT/PGUSER/PGDATABASE).
set -euo pipefail
cd "$(dirname "$0")"
if [ -z "${PGHOST:-}" ]; then
  PGBIN=$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)
  D=$(mktemp -d); chmod 777 "$D"
  SOCK=$(mktemp -d); chmod 777 "$SOCK"
  RUN() { if [ "$(id -u)" = 0 ]; then runuser -u postgres -- "$@"; else "$@"; fi; }
  RUN "$PGBIN/initdb" -D "$D/data" -A trust >/dev/null
  RUN "$PGBIN/pg_ctl" -D "$D/data" -o "-k $SOCK -c listen_addresses=''" -l "$D/log" -w start >/dev/null
  trap 'RUN "$PGBIN/pg_ctl" -D "$D/data" -m immediate stop >/dev/null 2>&1 || true' EXIT
  export PGHOST="$SOCK" PGUSER=postgres PGDATABASE=postgres
fi
PSQL="psql -v ON_ERROR_STOP=1 -q"
$PSQL -f stub.sql
$PSQL -f ../schema.sql
$PSQL -f ../schema.sql >/dev/null   # schemat jest idempotentny
$PSQL -f schema.test.sql
