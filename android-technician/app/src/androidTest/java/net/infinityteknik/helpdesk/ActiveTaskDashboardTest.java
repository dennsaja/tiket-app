package net.infinityteknik.helpdesk;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.media.MediaMetadataRetriever;
import android.media.MediaPlayer;
import android.os.Build;
import android.view.View;
import android.widget.LinearLayout;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import net.infinityteknik.helpdesk.data.ApiClient;
import net.infinityteknik.helpdesk.data.SessionManager;
import net.infinityteknik.helpdesk.data.TicketItem;
import net.infinityteknik.helpdesk.data.UserProfile;
import net.infinityteknik.helpdesk.ui.ActiveTaskCard;
import net.infinityteknik.helpdesk.ui.MainActivity;
import net.infinityteknik.helpdesk.ui.TechnicianBumperView;
import net.infinityteknik.helpdesk.util.OfflineSyncManager;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.File;
import java.io.FileOutputStream;
import java.lang.reflect.Field;
import java.util.Collections;
import java.util.concurrent.atomic.AtomicBoolean;
import static org.junit.Assert.*;

/** Offline fixture on Android 11; it never signs in to or modifies a production account. */
@RunWith(AndroidJUnit4.class)
public class ActiveTaskDashboardTest {
    private Activity activity;
    private android.app.Instrumentation instrumentation() { return InstrumentationRegistry.getInstrumentation(); }
    private Context context() { return instrumentation().getTargetContext(); }

    private TicketItem ticket(String status) throws Exception {
        return ApiClient.INSTANCE.parseTicketObject(new JSONObject()
            .put("id", "qa-bumper-ticket").put("ticketNumber", 801)
            .put("title", "Perbaikan koneksi pelanggan").put("reporterName", "Budi Santoso")
            .put("status", status).put("priority", "high").put("updatedAt", "2026-10-25T01:00:00Z"));
    }

    private void open() throws Exception {
        assertEquals("Only Android 11 is allowed", 30, Build.VERSION.SDK_INT);
        SessionManager session = new SessionManager(context());
        session.saveUser(new UserProfile("qa-bumper", "Raka Teknisi", "qa@example.test", "agent", null, null, 1), "offline-bumper-fixture");
        OfflineSyncManager.INSTANCE.prepareAccount(context(), "qa-bumper");
        OfflineSyncManager.INSTANCE.saveCachedTickets(context(), Collections.singletonList(ticket("in_progress")));
        activity = instrumentation().startActivitySync(new Intent(context(), MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        instrumentation().waitForIdleSync();
    }

    private boolean playing(TechnicianBumperView bumper) throws Exception {
        Field field = TechnicianBumperView.class.getDeclaredField("player"); field.setAccessible(true);
        AtomicBoolean result = new AtomicBoolean(false);
        instrumentation().runOnMainSync(() -> {
            try { MediaPlayer player = (MediaPlayer)field.get(bumper); result.set(player != null && player.isPlaying()); }
            catch (IllegalAccessException error) { throw new AssertionError(error); }
        });
        return result.get();
    }

    @Test public void videoPlaysOnlyOnTheActiveDashboardAndTheCardClearsWhenDone() throws Exception {
        open();
        ActiveTaskCard card = activity.findViewById(R.id.activeTaskCard);
        TechnicianBumperView bumper = activity.findViewById(R.id.activeTaskBumper);
        assertEquals(View.VISIBLE, card.getVisibility());
        boolean started = false;
        for (int i = 0; i < 60; i++) { if (playing(bumper)) { started = true; break; } Thread.sleep(200); }
        assertTrue("Bundled bumper did not start", started);
        Thread.sleep(1200);
        Bitmap screenshot = instrumentation().getUiAutomation().takeScreenshot();
        try (FileOutputStream output = new FileOutputStream(new File(context().getExternalFilesDir(null), "active-task-dashboard.png"))) {
            assertNotNull(screenshot); screenshot.compress(Bitmap.CompressFormat.PNG, 100, output);
        }
        screenshot.recycle();
        LinearLayout navigation = activity.findViewById(R.id.bottomNavigation);
        instrumentation().runOnMainSync(() -> navigation.getChildAt(1).performClick());
        assertFalse("Video kept decoding on another tab", playing(bumper));
        instrumentation().runOnMainSync(() -> navigation.getChildAt(0).performClick());
        started = false;
        for (int i = 0; i < 40; i++) { if (playing(bumper)) { started = true; break; } Thread.sleep(150); }
        assertTrue("Video did not resume on the dashboard", started);
        TicketItem finished = ticket("resolved");
        instrumentation().runOnMainSync(() -> card.bind(Collections.singletonList(finished), "agent"));
        assertEquals(View.GONE, card.getVisibility());
        assertFalse("Video kept decoding after the task finished", playing(bumper));
    }

    @Test public void bundledVideoHasTheExpectedDurationAndDimensions() throws Exception {
        assertEquals(30, Build.VERSION.SDK_INT);
        MediaMetadataRetriever metadata = new MediaMetadataRetriever();
        try (android.content.res.AssetFileDescriptor asset = context().getResources().openRawResourceFd(R.raw.technician_work_bumper)) {
            metadata.setDataSource(asset.getFileDescriptor(), asset.getStartOffset(), asset.getLength());
            assertEquals("5000", metadata.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION));
            assertEquals("960", metadata.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH));
            assertEquals("640", metadata.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT));
        } finally { metadata.release(); }
    }

    @After public void cleanUp() {
        if (activity != null) instrumentation().runOnMainSync(() -> activity.finish());
        new SessionManager(context()).logout();
    }
}
