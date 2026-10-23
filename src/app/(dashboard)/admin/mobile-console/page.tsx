import { requireNocOrOwner } from "@/lib/auth/helpers";
import { MobileConsole } from "./console";
import apkRelease from "../../../../../public/downloads/version.json";

export default async function MobileConsolePage() {
  await requireNocOrOwner();
  return <MobileConsole apkVersion={apkRelease.versionName} apkSupportsConsole={apkRelease.versionCode >= 12} />;
}
