package net.infinityteknik.helpdesk;

import android.app.Activity;
import android.content.Intent;
import android.os.Build;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.After;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.TextView;
import net.infinityteknik.helpdesk.data.SessionManager;
import net.infinityteknik.helpdesk.ui.MainActivity;
import net.infinityteknik.helpdesk.ui.AppUpdateActivity;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/** Runs only on API 30. Uses an offline account fixture; no production data is written. */
@RunWith(AndroidJUnit4.class)
public class Android11WorkspaceTest {
    private android.app.Instrumentation getInstrumentation() { return InstrumentationRegistry.getInstrumentation(); }
    private Activity activity;
    private void open(String role) {
        assertEquals("Only Android 11 is allowed for this check", 30, Build.VERSION.SDK_INT);
        SessionManager session = new SessionManager(getInstrumentation().getTargetContext());
        session.setToken("android11-offline-fixture"); session.setUserId("qa-" + role);
        session.setUserRole(role); session.setUserName("Android 11 QA");
        Intent intent = new Intent(getInstrumentation().getTargetContext(), MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        activity = getInstrumentation().startActivitySync(intent);
        getInstrumentation().waitForIdleSync();
    }
    private boolean text(View view, String value) {
        if (view instanceof TextView && ((TextView)view).getText().toString().contains(value)) return true;
        if (view instanceof ViewGroup) for (int i=0;i<((ViewGroup)view).getChildCount();i++) if (text(((ViewGroup)view).getChildAt(i),value)) return true;
        return false;
    }
    private WebView web(View view) {
        if (view instanceof WebView) return (WebView)view;
        if (view instanceof ViewGroup) for (int i=0;i<((ViewGroup)view).getChildCount();i++) { WebView found = web(((ViewGroup)view).getChildAt(i)); if(found!=null)return found; }
        return null;
    }
    private String evaluate(WebView view, String script) throws Exception {
        CountDownLatch done = new CountDownLatch(1); AtomicReference<String> result = new AtomicReference<>();
        getInstrumentation().runOnMainSync(() -> view.evaluateJavascript(script, value -> {result.set(value);done.countDown();}));
        assertTrue("WebView did not respond", done.await(10,TimeUnit.SECONDS)); return result.get();
    }
    @Test public void testOwnerAndSatelliteOverlays() throws Exception {
        open("owner"); assertTrue(text(activity.getWindow().getDecorView(),"OWNER WORKSPACE"));
        WebView map = web(activity.getWindow().getDecorView()); assertNotNull(map);
        boolean ready=false;
        for(int i=0;i<100;i++){ if("\"function\"".equals(evaluate(map,"typeof window.renderTracking"))){ready=true;break;} Thread.sleep(100); }
        assertTrue("Local tracking map scripts failed to load",ready);
        String payload="{topology:{nodes:[{id:'odp1',name:'QA ODP',kind:'odp',coordinates:[110.85,-6.76]}],links:[{kind:'odp',traced:true,coordinates:[[110.85,-6.76],[110.86,-6.76]]}]},locations:{technicians:[],tickets:[]}}";
        assertEquals("true",evaluate(map,"(function(){renderTracking("+payload+");var before=dataLayer.getLayers().length;mode(true);mode(false);return before===2&&dataLayer.getLayers().length===before&&map.hasLayer(dataLayer);})()"));
    }
    @Test public void testAdminWorkspace(){open("admin");assertTrue(text(activity.getWindow().getDecorView(),"ADMIN WORKSPACE"));assertNotNull(web(activity.getWindow().getDecorView()));}
    @Test public void testTechnicianWorkspace(){open("agent");assertTrue(text(activity.getWindow().getDecorView(),"SUPPORT WORKSPACE"));assertNull(web(activity.getWindow().getDecorView()));}
    @Test public void testInvalidUpdateShowsRealFailure() throws Exception {
        open("agent");
        Intent intent = new Intent(getInstrumentation().getTargetContext(), AppUpdateActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK).putExtra("release","{\"versionName\":\"QA\",\"fileSizeBytes\":0,\"sha256\":\"invalid\"}");
        activity.finish(); activity=getInstrumentation().startActivitySync(intent);
        Thread.sleep(1000);getInstrumentation().waitForIdleSync();
        android.view.accessibility.AccessibilityNodeInfo root = getInstrumentation().getUiAutomation().getRootInActiveWindow();
        assertNotNull("Update dialog missing", root);
        assertFalse("Failure state missing",root.findAccessibilityNodeInfosByText("Pembaruan gagal").isEmpty());
    }
    @After public void tearDown() throws Exception { if(activity!=null)getInstrumentation().runOnMainSync(()->activity.finish()); }
}
