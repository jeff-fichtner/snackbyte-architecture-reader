# Releasing

How a version of `@snackbyte/architecture-reader` reaches npm. The steady state is two steps: set the
version and merge, then approve the staged version on npmjs.com with 2FA. The first release has
two extra steps, done once, because npm configures a trusted publisher only on a package that
already exists.

## 1. The first publish, once

From your own machine, signed in to npm (`npm login`) with 2FA on the account, on `main` at the
commit to publish:

```text
npm ci
npm publish --access public
```

`prepublishOnly` runs the full gate (`npm run check:all`) and `prepack` builds before anything is
sent; npm asks for the 2FA code. This is the only publish that comes from a machine, and the only
version without provenance. Its version is the one already tagged (`v<version>`), so the release
workflow finds it tagged and published, and releases nothing for it.

Until this publish, every run of the release workflow warns that the package is not on npm yet,
and releases nothing.

## 2. Configure the trusted publisher, once

On npmjs.com: Packages → `@snackbyte/architecture-reader` → Settings → Trusted publishing → GitHub
Actions:

- **Organization or user**: `jeff-fichtner`
- **Repository**: `snackbyte-architecture-reader`
- **Workflow filename**: `release.yml`
- **Environment name**: leave empty
- **Allowed actions**: leave `npm publish` and `npm dist-tag` off. `npm stage publish` is always
  allowed, so the workflow can stage and nothing else; a direct `npm publish` from it is refused.

Or from a terminal, with npm 11.15 or later:

```text
npm trust github @snackbyte/architecture-reader --repo jeff-fichtner/snackbyte-architecture-reader --file release.yml --allow-stage-publish --yes
```

A new trusted publisher must complete its first publish within two days, or it expires and has to
be deleted and created again. Release the next version (section 3) within two days of this step.

That is the credential. There is no token to create, store or rotate. An `NPM_TOKEN` secret on
this repository is never used; delete it if one appears.

## 3. Every release

1. Set `version` in `package.json` to the version you intend, and update the README's install line
   to match (a test checks it). Merge to `main`.
2. The release workflow runs the gate, the release-flow action tags `v<version>`, and the publish
   job stages the version with `npm stage publish --access public --provenance`, authenticated by
   the run's OIDC identity. The repository is public, so the version carries provenance.
3. Approve it: on npmjs.com, the **Staged Packages** tab of your account settings, review the
   version and **Approve** with 2FA. From a terminal, `npm stage list @snackbyte/architecture-reader`
   names its stage id, and `npm stage approve <stage-id>` approves it. Until then the version is
   not installable.

A merge with no version change finds its version tagged and published, and releases nothing. A
merge whose version is tagged but not on npm (staged and awaiting approval, or never staged) fails
loudly in the release-flow action: approve the staged version and re-run the failed run, or bump
the version and merge again.

## 4. A bad version: deprecate, never unpublish

A published version is permanent. Retire it and roll forward:

```text
npm deprecate @snackbyte/architecture-reader@0.0.0 "what is wrong, and which version to use"
```

with the bad version in place of `0.0.0`. Then release the fix by section 3.

## 5. When a run fails after the tag exists

The tag is pushed before the publish job runs, so a failed publish leaves a tag with no version
behind it on npm. Fix forward: bump the version and merge again. Do not move or delete the tag.
