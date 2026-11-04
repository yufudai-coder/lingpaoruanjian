package com.example.app

import android.content.Context
import com.example.license.LicenseManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject

/** Kotlin integration example; call from a coroutine, never on the main thread. */
class AppLicense(context: Context) {
    private val manager = LicenseManager(context)

    suspend fun activate(code: String): JSONObject = withContext(Dispatchers.IO) {
        manager.activate(code)
    }

    suspend fun restore(originalCode: String): JSONObject = withContext(Dispatchers.IO) {
        manager.restore(originalCode)
    }

    suspend fun checkTrial(code: String): JSONObject = withContext(Dispatchers.IO) {
        manager.checkTrial(code)
    }

    fun hasPermanentAccess(): Boolean = manager.hasValidPermanentLicense()
}
