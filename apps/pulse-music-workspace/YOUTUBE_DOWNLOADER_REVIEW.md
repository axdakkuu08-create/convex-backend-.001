# Review: external YouTube downloader bot snippet

## Decision

Do not copy the bot command into Pulse. Reuse only the general idea of
presenting a track title and artwork alongside a provider result. Pulse already
has a YouTube / YouTube Music link resolver that opens the official
privacy-enhanced embed player, plus a shared queue for supported direct-audio
providers and Internet Archive results.

## Why the downloader is not an app provider

The pasted script is a messaging-bot command, not a browser music-source
adapter. It:

- searches YouTube using the third-party `yt-search` package;
- calls the unverified `arun-music.onrender.com/download` service to extract
  MP3/MP4 files;
- trusts a returned `file_url` and downloads it to a server-side cache;
- sends the file as a messaging attachment, which does not fit Pulse's browser
  player or provider interface.

The endpoint's current availability, security, permissions, and terms have not
been verified. A successful code review must not imply the endpoint was tested.

## Safe integration path

- Keep YouTube / YouTube Music URLs on the official embedded-player path.
- Keep Pulse's existing shared queue for direct audio URLs and Internet Archive
  files supported by their metadata.
- Preserve the existing source attribution and Convex library events for
  supported queue tracks.
- If searchable YouTube metadata is needed later, use the official YouTube Data
  API with a configured API key and quota handling, or let the user paste a
  YouTube URL. Search metadata does not itself grant an audio download or direct
  stream.
- Do not put API secrets in browser code or route arbitrary returned URLs into
  automatic downloads.

## Verification boundary

Automated tests can verify URL resolution and that Pulse has no dependency on
the third-party downloader endpoint. They cannot prove that a live YouTube embed
is available for every video, nor that any third-party downloader works. Actual
playback remains subject to YouTube's embedding, regional, age, account, and
content restrictions.
