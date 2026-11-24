package app.unifiedmusic

import android.app.Application
import com.clerk.api.Clerk
import com.clerk.convex.createClerkConvexClient
import dev.convex.android.ConvexClientWithAuth

class UnifiedMusicApplication : Application() {
    var convexClient: ConvexClientWithAuth<String>? = null
        private set

    override fun onCreate() {
        super.onCreate()
        val publishableKey = BuildConfig.CLERK_PUBLISHABLE_KEY
        val deploymentUrl = BuildConfig.CONVEX_URL
        if (publishableKey.isNotBlank() && deploymentUrl.isNotBlank()) {
            Clerk.initialize(context = this, publishableKey = publishableKey)
            convexClient = createClerkConvexClient(
                deploymentUrl = deploymentUrl,
                context = applicationContext
            )
        }
    }
}
