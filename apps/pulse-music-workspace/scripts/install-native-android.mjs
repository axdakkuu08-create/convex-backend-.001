import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const android = path.join(root, "android");
const template = path.join(root, "android-native");
const javaSource = path.join(template, "src/main/java/com/pulse/music");
const javaTarget = path.join(android, "app/src/main/java/com/pulse/music");
const gradlePath = path.join(android, "app/build.gradle");
const manifestPath = path.join(android, "app/src/main/AndroidManifest.xml");
const activityPath = path.join(javaTarget, "MainActivity.java");

await mkdir(javaTarget, { recursive: true });
await cp(javaSource, javaTarget, { recursive: true, force: true });

let gradle = await readFile(gradlePath, "utf8");
const mediaDependencies = [
  '    implementation "androidx.media3:media3-exoplayer:1.8.0"',
  '    implementation "androidx.media3:media3-session:1.8.0"',
  '    implementation "androidx.media3:media3-ui:1.8.0"',
].join("\n");
if (!gradle.includes("androidx.media3:media3-exoplayer")) {
  if (!/dependencies\s*\{/.test(gradle)) throw new Error("Could not locate app Gradle dependencies block");
  gradle = gradle.replace(/dependencies\s*\{/, (match) => match + "\n" + mediaDependencies);
  await writeFile(gradlePath, gradle);
}

let manifest = await readFile(manifestPath, "utf8");
const permissions = [
  '    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />',
  '    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />',
].join("\n");
if (!manifest.includes("FOREGROUND_SERVICE_MEDIA_PLAYBACK")) {
  manifest = manifest.replace("<application", permissions + "\n    <application");
}
const service = `
        <service
            android:name="com.pulse.music.PulseAudioService"
            android:exported="true"
            android:foregroundServiceType="mediaPlayback">
            <intent-filter>
                <action android:name="androidx.media3.session.MediaSessionService" />
            </intent-filter>
        </service>`;
if (!manifest.includes("com.pulse.music.PulseAudioService")) {
  manifest = manifest.replace("</application>", service + "\n    </application>");
}
await writeFile(manifestPath, manifest);

let activity = await readFile(activityPath, "utf8");
if (!activity.includes("PulseMedia3Plugin")) {
  activity = activity.replace(
    /import com\.getcapacitor\.BridgeActivity;\s*/,
    "import com.getcapacitor.BridgeActivity;\nimport android.os.Bundle;\nimport com.pulse.music.PulseMedia3Plugin;\n",
  );
  activity = activity.replace(
    /public class MainActivity extends BridgeActivity\s*\{\s*\}/,
    "public class MainActivity extends BridgeActivity {\n    @Override\n    public void onCreate(Bundle savedInstanceState) {\n        registerPlugin(PulseMedia3Plugin.class);\n        super.onCreate(savedInstanceState);\n    }\n}",
  );
  await writeFile(activityPath, activity);
}
console.log("Installed Pulse Media3 service, Capacitor plugin, manifest, and dependencies.");
