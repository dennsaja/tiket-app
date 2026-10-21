package net.infinityteknik.helpdesk

import net.infinityteknik.helpdesk.util.LocationPolicy
import net.infinityteknik.helpdesk.util.WebLoginState
import org.junit.Assert.*
import org.junit.Test

class SafetyPolicyTest {
    @Test fun gpsRequiresAnAuthenticatedTechnicianWithWorkAndPermission() {
        assertTrue(LocationPolicy.canTrack(true, "agent", 1, true, true))
        assertFalse(LocationPolicy.canTrack(false, "agent", 1, true, true))
        assertFalse(LocationPolicy.canTrack(true, "admin", 1, true, true))
        assertFalse(LocationPolicy.canTrack(true, "agent", 0, true, true))
        assertFalse(LocationPolicy.canTrack(true, "agent", 1, false, true))
        assertFalse(LocationPolicy.canTrack(true, "agent", 1, true, false))
    }
    @Test fun staleOrFutureFixesCannotBePresentedAsLiveGps() {
        assertTrue(LocationPolicy.isFresh(1_000_000, 1_120_000))
        assertFalse(LocationPolicy.isFresh(1_000_000, 1_120_001))
        assertFalse(LocationPolicy.isFresh(1_000_001, 1_000_000))
        assertFalse(LocationPolicy.isFresh(0, 1_000_000))
    }
    @Test fun missingInvalidAndInventedCoordinatesAreRejected() {
        assertTrue(LocationPolicy.hasCoordinates(-6.7, 110.8))
        assertTrue(LocationPolicy.hasCoordinates(0.0, 110.8))
        assertFalse(LocationPolicy.hasCoordinates(null, 110.8))
        assertFalse(LocationPolicy.hasCoordinates(0.0, 0.0))
        assertFalse(LocationPolicy.hasCoordinates(91.0, 110.8))
        assertFalse(LocationPolicy.hasCoordinates(-6.7, Double.NaN))
    }
    @Test fun finishedTicketsIncludeCancelledJobs() {
        for (status in listOf("resolved", "closed", "cancelled")) assertTrue(LocationPolicy.isFinished(status))
        for (status in listOf("assigned", "accepted", "in_progress", "pending")) assertFalse(LocationPolicy.isFinished(status))
    }
    @Test fun browserCallbacksRequireAnUnexpiredMatchingAppInitiatedState() {
        val state = WebLoginState.create()
        assertEquals(64, state.length)
        assertTrue(state.matches(Regex("[a-f0-9]{64}")))
        assertNotEquals(state, WebLoginState.create())
        assertTrue(WebLoginState.matches(state, state, 10_000, 20_000))
        assertFalse(WebLoginState.matches(state, WebLoginState.create(), 10_000, 20_000))
        assertFalse(WebLoginState.matches(state, null, 10_000, 20_000))
        assertFalse(WebLoginState.matches(null, state, 10_000, 20_000))
        assertFalse(WebLoginState.matches(state, state, 10_000, 310_001))
        assertFalse(WebLoginState.matches(state, state, 10_000, 9_999))
    }
}
