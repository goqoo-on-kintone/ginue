# Ginue

English | [日本語](/README.ja.md)

A CLI tool to manage kintone app settings via the kintone REST API with a Git-like workflow.

> **📢 Notice**
>
> v3.0 is the first and final feature release of the TypeScript version. Bug fix patches (v3.0.x) may be released as needed.
> Development will continue with v4, rewritten in Go, distributed as a single binary without requiring Node.js.
>
> - v2: JavaScript version (maintenance mode)
> - **v3: TypeScript version (current)**
> - v4: Go version (in development)

## Installation

Global installation:

```bash
npm install -g ginue
# or
yarn global add ginue
```

Per-project installation:

```bash
npm install --save-dev ginue
# or
yarn add --dev ginue
```

## Usage

Ginue provides Git-like commands:

* [ginue pull](#ginue-pull): Fetch kintone app settings
* [ginue push](#ginue-push): Upload settings to kintone
* [ginue deploy](#ginue-deploy): Deploy settings to production environment
* [ginue reset](#ginue-reset): Cancel pending changes
* [ginue erd](#ginue-erd): (Experimental) Generate ER diagram from lookup relationships
* [ginue diff](#ginue-diff): (Experimental) Show diff between environments

### Common Options

```
  -v, --version                    Output version information
  -h, --help                       Output usage information
  -d, --domain=<DOMAIN>            kintone domain name
  -u, --user=<USER>                kintone username
  -p, --password=<PASSWORD>        kintone password
  -a, --app=<APP-ID>               kintone app IDs
  -g, --guest=<GUEST-SPACE-ID>     kintone guest space ID
  -b, --basic=<USER[:PASSWORD]>    kintone Basic Authentication user and password
  -A, --appName=<APP-NAME>         Set target app name
  -l, --location=<LOCATION>        Location of settings file
  -t, --fileType=<FILE-TYPE>       Set file type 'json'(default) or 'js'
  -F, --pfxFilepath=<PFX-FILEPATH> The path to client certificate file
  -P, --pfxPassword=<PFX-PASSWORD> The password of client certificate
  --oauth                          Use OAuth 2.0 authentication (requires gyuma)
  --preview                        Fetch from test environment instead of production
  --alt                            Save with alternate format (masks environment-specific values)
  --downloadJs                     Download JS/CSS customization files
  --proxy=<PROXY-URL>              Proxy server URL
```

* If `domain`, `user`, `password`, or `app` options are omitted, you will be prompted for input.
* Multiple app IDs can be specified with commas (e.g., `-a 10,11,12`).
* The `guest` option is required for apps in guest spaces.
* Options can also be set via `.ginuerc` config file, `.netrc`, or environment variables.
* Priority: `CLI args > .ginuerc > .netrc > environment variables`

### .ginuerc

Create a `.ginuerc` config file in your project directory for automatic option loading. Supports JSON, JS, and YAML formats.

**.ginuerc.json**
```json
{
  "location": "kintone-settings",
  "domain": "example.cybozu.com",
  "username": "Administrator",
  "password": "myPassword",
  "app": [10, 11, 12]
}
```

**Multi-environment configuration:**
```json
{
  "location": "kintone-settings",
  "env": {
    "development": {
      "domain": "dev.cybozu.com",
      "app": { "user": 128, "order": 129 }
    },
    "production": {
      "domain": "prod.cybozu.com",
      "app": { "user": 10, "order": 11 }
    }
  }
}
```

## ginue pull

Fetches kintone app settings and saves them as JSON files.

* Creates a directory per app containing all settings JSON files.
* The `revision` field is extracted to a separate `revision.json` file for cleaner diffs.
* Use `--preview` to fetch settings from the test environment instead of production.

```bash
ginue pull -d example.cybozu.com -a 10,11,12 -u Administrator
ginue pull -A user --preview
```

## ginue push

Uploads local JSON settings to kintone's test environment.

* Push to the same environment: `ginue push development`
* Push across environments: `ginue push development:production`
* After pushing, use kintone's UI to "Update App" or "Discard Changes", or use `ginue deploy` / `ginue reset`.

```bash
ginue push development
ginue push development:production
ginue push development:production -A user
```

## ginue deploy

Deploys settings from the test environment to production.

```bash
ginue deploy development
ginue deploy development -A user
```

## ginue reset

Cancels pending changes in the test environment.

```bash
ginue reset development
ginue reset development -A user
```

## ginue erd

⚠️ Experimental feature. May be unstable.

Generates an ER diagram (PlantUML format) from lookup field relationships.

```bash
ginue erd development
```

## ginue diff

⚠️ Experimental feature. May be unstable.

Opens a visual diff viewer ([twins-diff](https://github.com/the-red/twins-diff)) to compare settings between environments.

```bash
ginue diff development
ginue diff development:production
```

## License

MIT
