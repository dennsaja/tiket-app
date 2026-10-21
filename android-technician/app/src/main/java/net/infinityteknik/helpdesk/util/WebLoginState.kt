package net.infinityteknik.helpdesk.util

import java.security.MessageDigest
import java.security.SecureRandom

object WebLoginState {
    const val MAX_AGE_MS = 5 * 60_000L
    fun create(): String = ByteArray(32).also { SecureRandom().nextBytes(it) }
        .joinToString("") { "%02x".format(it.toInt() and 0xff) }

    fun matches(expected: String?, returned: String?, createdAt: Long, now: Long): Boolean {
        if (expected.isNullOrBlank() || returned.isNullOrBlank()) return false
        if (expected.length != 64 || returned.length != 64) return false
        if (createdAt <= 0 || now < createdAt || now - createdAt > MAX_AGE_MS) return false
        return MessageDigest.isEqual(expected.toByteArray(Charsets.UTF_8), returned.toByteArray(Charsets.UTF_8))
    }
}
