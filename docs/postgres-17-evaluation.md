# PostgreSQL 17 evaluation

## Decision input

PostgreSQL 17 is a sound production-major choice for this migration. It is
currently supported through 8 November 2029. PostgreSQL 18 is also supported
and extends that window by roughly one year, through 14 November 2030. The
PostgreSQL project supports each major for five years and recommends using the
current minor release for the chosen major. [PostgreSQL versioning
policy](https://www.postgresql.org/support/versioning/)

The Node [`embedded-postgres`](https://github.com/leinelissen/embedded-postgres)
project explicitly supports PostgreSQL 17.10 on Linux x64 and arm64, along
with the other platforms in its support matrix. Its published package version
for that binary is `17.10.0-beta.17`; installing an arbitrary, newer PostgreSQL
minor version is not supported by the package. [Project
README](https://github.com/leinelissen/embedded-postgres#postgresql-versions)

## Recommendation

Pin the production Compose image to major `17` (never `latest`) and update it
to the current PostgreSQL 17 minor release during normal maintenance. Pin the
test harness to `embedded-postgres@17.10.0-beta.17`, or its later PostgreSQL
17 package release when available. The environments therefore share a major
version; their minor versions can briefly differ because the test package
publishes its own binaries on a separate cadence.

PostgreSQL 18 is a viable alternative if maximizing the support window matters
more than using the more established 17 series. It is not required for any
known application feature or migration decision.
