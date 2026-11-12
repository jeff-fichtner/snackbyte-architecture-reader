# Revisits at a feature's close

Decisions taken as best guesses, to look at again once they have been lived with. Read at every
feature's close (`/speckit-engine-close`). Each entry stays until Jeff retires it. The question
at each close: did we want it, did it end up as imagined, or was the option passed over better?

| Date | Decision | Chosen | Passed over |
|---|---|---|---|
| 2026-11-11 | How a consumer gets one fixed version of the reader | Install from GitHub at a version tag; the package builds itself on install (`prepare`) | Publishing to npm through the release action (needs the release flow wired and CI allowed to push tags, which only Jeff can grant) |
| 2026-11-11 | Error redirects in the first consumer's settings | Not modelled: the settings name error statuses and failure helpers; a redirect is an error answer only when a helper the settings name makes it | A settings rule that tells an error redirect from any other by its target, which would need matching on the target's text |
| 2026-11-11 | Functions written in an object literal that no entry rule matches | Each starts trips of its own as a `value`, since the object can be called through from anywhere | Treating them as steps only where called directly, which could hide a path through a stored object |
