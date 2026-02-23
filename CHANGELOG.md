# Changelog

English | [日本語](/CHANGELOG.ja.md)

All notable changes to this project will be documented in this file.

## [3.0.0] - 2025-02-23

The first and final feature release of the TypeScript version. Bug fix patches (v3.0.x) may be released as needed. v4 onwards will be rewritten in Go.

### Features

#### Authentication
- **OAuth 2.0** (`--oauth`): OAuth authentication via gyuma
- **Client certificates** (`--pfxFilepath`, `--pfxPassword`): Client certificate authentication support

#### Network
- **Proxy support** (`--proxy`): Access kintone through proxy servers
- Read proxy credentials from `.netrc`

#### New Commands
- **ginue diff**: Visual diff comparison between environments using [twins-diff](https://github.com/the-red/twins-diff)

#### Pull Enhancements
- **JS/CSS download** (`--downloadJs`): Download customization files
- **Alternate format** (`--alt`): Save with environment-specific values masked
- **Graph settings API** (`reports.json`): Fetch report settings
- **Sorted JSON output**: Automatic sorting for views.json and dropdown items
- `--preview` now saves to the same folder (no separate directory needed)

#### Push Enhancements
- **Interactive subtable field add/delete**: Resolve field differences interactively during push
- **Custom view skip**: Interactively skip when views.json contains custom views
- Display environment/app name during processing

### Breaking Changes

- **Node.js requirement**: Node.js 7.6+ → **18+**
- **Codebase**: Fully migrated from JavaScript to TypeScript
- **Entry point**: `./index.js` → `./dist/cli.js`
- **Test framework**: Mocha/power-assert → Jest
- **form.json**: Removed from pull targets (low practical value)

### Internal Changes

- Full TypeScript migration
- Utilize `@kintone/rest-api-client` type definitions
- Update ESLint for TypeScript support
- Add Jest unit tests (util.ts, converter.ts)
- Upgrade Prettier 1.x → 2.x
- Clean up dependencies (request/request-promise → node-fetch)

### Dependencies

#### Added
- `gyuma`: OAuth 2.0 authentication
- `twins-diff`: Environment diff viewer
- `proxy-agent`: Proxy support
- `open`: Browser launcher
- TypeScript-related packages

#### Removed
- `request` / `request-promise`: Replaced by node-fetch
- `require-from-string`: No longer needed
- `tslib`: No longer needed after TypeScript migration

---

## [2.2.1] - 2020-05-07

### Features

- Support Basic authentication via environment variable (`GINUE_BASIC`)

---

## [2.2.0] - 2020-05-07

### Features

- **Environment variables**: Set credentials via `GINUE_USERNAME`, `GINUE_PASSWORD`, `GINUE_BASIC`, etc.

### Security

- Multiple dependency security updates

---

## [2.1.0] - 2019-02-19

### Features

- **Interactive field addition**: Add missing fields interactively during push
- **Interactive field deletion**: Delete extra fields interactively during push
- **Language switching**: Switch kintone API response language
- OAuth 2.0 authentication foundation

---

## [2.0.0] - 2018-11-26

Major update from v1. Added push functionality and revamped ginuerc format.

### Features

#### New Commands
- **ginue push**: Upload local JSON files to kintone
- **ginue deploy**: Deploy test environment settings to production
- **ginue reset**: Cancel test environment changes
- **ginue erd**: Generate PlantUML ER diagram from lookup relationships

#### Cross-environment Support
- **Push to different environment**: `ginue push dev:prod` format
- Automatic conversion of lookup field app ID references

#### Pull Enhancements
- **--alt option**: Save with environment-specific values masked
- **--preview option**: Fetch JSON from test environment
- **--js option**: Save kintone settings in JS format
- Automatic app name masking

#### Authentication Enhancements
- **.netrc support**: Read username/password from .netrc
- Read Basic auth credentials from .netrc

#### Configuration
- **ginuerc extension**: Support YAML and JS formats (via rc-config-loader)
- **exclude option**: Exclude specific APIs
- **-l/--location option**: Set location from command line

#### Other
- Version info output (-v/--version)
- Command-specific help (-h/--help)
- Per-app processing (-A/--appName)

### Breaking Changes

- **ginuerc format change**: Array format → `env` object format
- **output option removed**: Renamed to `location` option

### Internal Changes

- Introduced Prettier code formatting
- Set up Mocha + power-assert testing environment
- Reorganized source code into lib directory

---

## [1.2.0] - 2018-01-19

### Features

- **Basic authentication** (`-b/--basic`): Specify Basic auth username and password
- **App name directories**: Create directories using app names instead of IDs

---

## [1.1.0] - 2018-01-18

### Features

- **Multiple environments**: Specify multiple environments as array in ginuerc, separate directories by environment
- Improved stdin handling for multiple environments

---

## [1.0.0] - 2017-12-01

Initial release. Provides functionality to fetch kintone app settings as local JSON files.

### Features

- **ginue pull**: Save kintone app settings as JSON files
- Supported APIs: app, form, fields, layout, views, acl, field_acl, customize, settings, status
- **Multiple apps**: Specify multiple app IDs with comma separation
- **Guest space support** (`-g/--guest`)
- **.ginuerc config file**: JSON format configuration file support
- Separate revision into dedicated file (revision.json)
