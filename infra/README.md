# Infrastructure boundary

This directory owns reproducible deployment, database migration, backup and
operational configuration. Provisioning credentials and provider exports never
belong in the repository.

The accepted target is recorded in
[ADR-0001](../docs/round-8/adr/ADR-0001-long-term-platform.md). A1 creates
configuration and verification scaffolding here; A2 adds PostgreSQL migrations
after the production and staging projects exist.
