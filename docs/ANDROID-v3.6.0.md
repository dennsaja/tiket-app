# HelpDesk Android 3.6.0

## Publication and installation

1. Build a signed APK with the existing application certificate. Increment `versionCode` for every native release.
2. After `:app:assembleRelease`, run `npx tsx scripts/android-release-manifest.ts` from the repository root. This copies the APK and records its hash, length, and normalized source fingerprint.
3. Commit and push the source, APK, and `public/downloads/version.json` together. Apply the web repository update first.
4. In **Console Android → Kirim APK terbaru ke tim**, select **Push update APK terbaru**. The server verifies the APK hash, length, and source fingerprint, and stores an immutable copy in `uploads/mobile-releases/`.
5. An authenticated foreground application receives a refresh through SSE (or its next foreground check) and displays **Update aplikasi tersedia**. Closed applications check when reopened; this release does not implement FCM.
6. **Update sekarang** opens the native updater. Android may first require the user to allow installations by HelpDesk. Download progress is calculated from received bytes. The app verifies length, SHA-256, package identity, version, and certificate before handing the APK to `PackageInstaller`.
7. Verification and installation display distinct indeterminate states; neither uses a simulated percentage. Android supplies the installation confirmation and success/failure result. A successful process replacement is also confirmed against the installed package version when the app next opens.

The first installation of 3.6.0 still uses `/download`; older APKs do not contain this updater. Later native code changes need a newly built APK. The console cannot send uncompiled Kotlin as executable application code. Remote configuration remains available separately.

Publication is available to NOC and Owner. APK downloads require a current active staff account. Receipts show the most recent report per account, including failure messages; they are not a list of every device or proof that an offline device has received a release.

## Role interfaces

- Owner: global ticket statistics, seven-day activity, technician performance for tickets created during the last 30 days, and live team tracking.
- Admin/NOC: global statistics, active priority counts, team workload, ticket monitoring, and live tracking.
- Technician: assignment workflow, personal ticket map, work reports, and GPS policy. Staff monitoring screens do not expose technician acceptance/report actions.

The server checks the account's current database role before returning management statistics or locations. The APK's stored role only selects its interface.

## Maps

The web dispatcher and Android staff map use Leaflet. Base maps and network overlays live in separate layers. Switching Peta/Satelit keeps network lines, nodes, ticket pins, and technician locations. The APK bundles Leaflet and the shared satellite helper, and keeps bearer credentials out of its WebView.

Satellite imagery requests native tiles through zoom 19 instead of enlarging zoom-17 imagery up to zoom 22. `blankTile=false` returns a real error for missing imagery; the helper retries a real parent tile rather than displaying a missing-data placeholder. Satellite zoom is capped at 19. Regional image resolution still depends on the imagery provider. GPS freshness allows six minutes for the existing five-minute reporting interval; older positions are explicitly marked as last known locations.

## Verification

The `codex/android36-check` workflow runs only Android 11/API 30. It checks role layouts using offline fixtures, preservation of topology overlays through satellite/street switching, the updater's invalid-metadata failure UI, an in-place upgrade from 3.5.0, and a clean installation/launch of the released APK. These fixtures do not sign in to or write to production. They do not prove production publication delivery or a real user's acceptance of an Android install prompt.
