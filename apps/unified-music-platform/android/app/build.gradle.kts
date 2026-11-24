plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.kapt")\n    id("org.jetbrains.kotlin.plugin.serialization")
}
android {
    namespace = "app.unifiedmusic"
    compileSdk = 35
    defaultConfig {
        applicationId = "app.unifiedmusic"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"\n        val convexUrl = providers.gradleProperty("UNIFIED_CONVEX_URL").orElse("").get().replace("\\", "\\\\").replace("\\", "\\\\").replace("\\\"","\\\\\\\"")\n        val clerkKey = providers.gradleProperty("UNIFIED_CLERK_PUBLISHABLE_KEY").orElse("").get().replace("\\", "\\\\").replace("\\\"","\\\\\\\"")\n        buildConfigField("String", "CONVEX_URL", "\\\"$convexUrl\\\"")\n        buildConfigField("String", "CLERK_PUBLISHABLE_KEY", "\\\"$clerkKey\\\"")
    }
    buildFeatures { compose = true; buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)
    androidTestImplementation(composeBom)
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    debugImplementation("androidx.compose.ui:ui-tooling")
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    kapt("androidx.room:room-compiler:2.6.1")
    implementation("androidx.media3:media3-exoplayer:1.5.1")
    implementation("androidx.media3:media3-session:1.5.1")\n    implementation("dev.convex:android-convexmobile:0.8.0@aar") { isTransitive = true }\n    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")\n    implementation("com.clerk:clerk-convex-kotlin:0.3.0")
}
