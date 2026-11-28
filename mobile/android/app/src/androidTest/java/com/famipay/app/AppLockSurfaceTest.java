package com.famipay.app;

import android.content.Context;
import android.view.View;
import android.view.WindowManager;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class AppLockSurfaceTest {
    @Test public void enabledLockHidesWebViewOnColdLaunchAndRecreation() {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        context.getSharedPreferences("famipay_device_lock", Context.MODE_PRIVATE).edit()
            .putBoolean("enabled",true).putInt("minutes",5).commit();
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                assertEquals(View.INVISIBLE, activity.getBridge().getWebView().getVisibility());
                assertTrue((activity.getWindow().getAttributes().flags & WindowManager.LayoutParams.FLAG_SECURE) != 0);
            });
            scenario.recreate();
            scenario.onActivity(activity -> assertEquals(View.INVISIBLE, activity.getBridge().getWebView().getVisibility()));
        } finally {
            context.getSharedPreferences("famipay_device_lock", Context.MODE_PRIVATE).edit().clear().commit();
        }
    }
}
