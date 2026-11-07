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
const pluginPath = path.join(javaTarget, "PulseMedia3Plugin.java");
const servicePath = path.join(javaTarget, "PulseAudioService.java");

for (const source of [
  path.join(javaSource, "PulseMedia3Plugin.java"),
  path.join(javaSource, "PulseAudioService.java"),
]) {
  await readFile(source, "utf8");
}

await mkdir(javaTarget, { recursive: true });
await cp(javaSource, javaTarget, { recursive: true, force: true });

let gradle = await readFile(gradlePath, "utf8");
const mediaDependencies = [
  '    implementation "androidx.media3:media3-exoplayer:1.8.0"',
  '    implementation "androidx.media3:media3-session:1.8.0"',
  '    implementation "androidx.media3:media3-ui:1.8.0"',
].join("\n");
if (!gradle.includes("androidx.media3:media3-exoplayer")) {
  const dependencyBlock = /dependencies\s*\{/;
  if (!dependencyBlock.test(gradle)) {
    throw new Error("Could not locate app Gradle dependencies block");
  }
  gradle = gradle.replace(dependencyBlock, (match) => match + "\n" + mediaDependencies);
  await writeFile(gradlePath, gradle);
}

let manifest = await readFile(manifestPath, "utf8");
const permissions = [
  '    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />',
  '    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />',
];
for (const permission of permissions) {
  const permissionName = permission.match(/android:name="([^"]+)"/)[1];
  if (!manifest.includes(permissionName)) {
    manifest = manifest.replace("<application", permission + "\n    <application");
  }
}
if (!manifest.includes("com.pulse.music.PulseAudioService")) {
  const service = `
        <service
            android:name="com.pulse.music.PulseAudioService"
            android:exported="true"
            android:foregroundServiceType="mediaPlayback">
            <intent-filter>
                <action android:name="androidx.media3.session.MediaSessionService" />
            </intent-filter>
        </service>`;
  if (!manifest.includes("</application>")) {
    throw new Error("Could not locate Android manifest application closing tag");
  }
  manifest = manifest.replace("</application>", service + "\n    </application>");
}
await writeFile(manifestPath, manifest);

let activity = await readFile(activityPath, "utf8");
const bridgeImport = "import com.getcapacitor.BridgeActivity;";
if (!activity.includes(bridgeImport)) {
  throw new Error("Generated MainActivity does not extend the expected Capacitor BridgeActivity");
}
if (!activity.includes("import android.os.Bundle;")) {
  activity = activity.replace(
    bridgeImport,
    bridgeImport + "\nimport android.os.Bundle;",
  );
}
if (!activity.includes("import com.pulse.music.PulseMedia3Plugin;")) {
  activity = activity.replace(
    bridgeImport,
    bridgeImport + "\nimport com.pulse.music.PulseMedia3Plugin;",
  );
}

const classDeclaration = /public\s+class\s+MainActivity\s+extends\s+BridgeActivity\s*\{/;
if (!classDeclaration.test(activity)) {
  throw new Error("Could not locate MainActivity class declaration for plugin registration");
}
if (!activity.includes("registerPlugin(PulseMedia3Plugin.class)")) {
  const onCreate = /public\s+void\s+onCreate\s*\(\s*Bundle\s+savedInstanceState\s*\)\s*\{/;
  if (onCreate.test(activity)) {
    activity = activity.replace(
      onCreate,
      (match) => match + "\n        registerPlugin(PulseMedia3Plugin.class);",
    );
  } else {
    activity = activity.replace(
      classDeclaration,
      (match) =>
        match +
        "\n    @Override\n    public void onCreate(Bundle savedInstanceState) {\n        registerPlugin(PulseMedia3Plugin.class);\n        super.onCreate(savedInstanceState);\n    }",
    );
  }
}
if (!activity.includes("registerPlugin(PulseMedia3Plugin.class)")) {
  throw new Error("PulseMedia3 native plugin registration was not applied");
}
await writeFile(activityPath, activity);

const [pluginSource, serviceSource, finalGradle, finalManifest, finalActivity] =
  await Promise.all([
    readFile(pluginPath, "utf8"),
    readFile(servicePath, "utf8"),
    readFile(gradlePath, "utf8"),
    readFile(manifestPath, "utf8"),
    readFile(activityPath, "utf8"),
  ]);
if (!pluginSource.includes('@CapacitorPlugin(name = "PulseMedia3")')) {
  throw new Error("PulseMedia3 plugin annotation is missing");
}
if (!serviceSource.includes("extends MediaSessionService")) {
  throw new Error("PulseAudioService is not a MediaSessionService");
}
if (!finalGradle.includes("androidx.media3:media3-exoplayer")) {
  throw new Error("Media3 ExoPlayer dependency was not installed");
}
if (!finalManifest.includes("com.pulse.music.PulseAudioService")) {
  throw new Error("PulseAudioService is not registered in AndroidManifest.xml");
}
if (!finalActivity.includes("registerPlugin(PulseMedia3Plugin.class)")) {
  throw new Error("PulseMedia3 plugin is not registered in MainActivity");
}

console.log("Verified PulseMedia3 plugin, MediaSessionService, Gradle dependencies, and Android manifest registration.");
